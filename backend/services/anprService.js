'use strict';

/**
 * SmartPark - The complete entrance ANPR pipeline.
 *
 *   Camera -> Vehicle detection -> Plate localisation -> OCR
 *          -> Plate repair/validation -> Slot allocation -> Database
 *
 * Every stage is timed and logged so the UI can show a live console during the
 * demo, and so the design can be explained in a viva.
 */

const config = require('../config');
const layout = require('../data/layout');
const { getStore } = require('../database');
const { detectVehicle } = require('../../ai/numberPlateDetection/vehicleDetector');
const { locatePlate } = require('../../ai/numberPlateDetection/plateLocator');
const ocr = require('../../ai/ocr/ocrEngine');
const { assignSlot } = require('./slotAllocator');
const { findActiveVehicle } = require('./parkingService');

const STAGE_LABELS = {
  camera: 'Entrance camera',
  'vehicle-detection': 'Vehicle detection',
  'plate-localisation': 'Number plate localisation',
  ocr: 'Optical character recognition',
  'plate-validation': 'Plate validation',
  'duplicate-check': 'Duplicate vehicle check',
  'slot-allocation': 'Parking slot allocation',
  database: 'Database write',
};

function plateImageDataUri(plateText) {
  const svg = ocr.renderPlateSvg(plateText);
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/**
 * Runs a full simulated camera pass.
 *
 * @param {object}  options
 * @param {string} [options.plateHint]     force a specific plate
 * @param {string} [options.vehicleType]
 * @param {string} [options.ownerName]
 * @param {boolean}[options.store]         persist the result (default true)
 * @param {string} [options.frameId]
 * @returns {Promise<object>} pipeline report
 */
async function processCameraFrame(options = {}) {
  const frameId = options.frameId || `FRAME-${Date.now()}`;
  const startedAt = new Date();
  const stages = [];
  const record = (stage, detail, ms, ok = true) => {
    stages.push({ stage, label: STAGE_LABELS[stage] || stage, detail, ok, ms });
  };

  // 1 ---------------------------------------------------------------- camera
  record('camera', `${config.camera.id} captured frame ${frameId} at ${config.camera.location}`, 12);

  // 2 ---------------------------------------------------- vehicle detection
  const detection = detectVehicle({ frameId, forceDetection: options.forceDetection });
  if (!detection.detected) {
    record('vehicle-detection', 'No vehicle detected in the lane - frame discarded', detection.processingMs, false);
    return {
      success: false,
      reason: 'NO_VEHICLE',
      frameId,
      stages,
      startedAt,
      finishedAt: new Date(),
    };
  }
  record(
    'vehicle-detection',
    `${detection.vehicle.class.toUpperCase()} detected (confidence ${(detection.vehicle.confidence * 100).toFixed(1)}%)`,
    detection.processingMs,
  );

  // 3 ---------------------------------------------- plate localisation (ROI)
  const plate = locatePlate(detection);
  record(
    'plate-localisation',
    `Plate ROI ${plate.roi.width}x${plate.roi.height}px at (${plate.roi.x}, ${plate.roi.y}), deskew ${plate.angle}deg`,
    plate.processingMs,
  );

  // 4 ------------------------------------------------------------------ OCR
  const ocrResult = await ocr.readNumberPlate({ frameId, plateHint: options.plateHint, detection, plateRegion: plate });
  record('ocr', `Raw text "${ocrResult.text}" via ${ocrResult.engine} (confidence ${ocrResult.confidence}%)`, ocrResult.processingMs);

  // 5 --------------------------------------------------- plate validation
  const parsed = ocrResult.parsed;
  if (!parsed.valid) {
    record('plate-validation', `Rejected: ${parsed.issues.join('; ') || 'unreadable plate'}`, 3, false);
    return {
      success: false,
      reason: 'INVALID_PLATE',
      frameId,
      rawText: ocrResult.text,
      ocr: summariseOcr(ocrResult),
      stages,
      startedAt,
      finishedAt: new Date(),
    };
  }
  record('plate-validation', `Valid Indian plate ${parsed.vehicleNumber} (${parsed.state}-${parsed.rto})`, 3);

  // 5b ------------------------------------------- duplicate / known vehicle
  // Checked *before* allocating so a duplicate entry never reserves a bay.
  const active = await findActiveVehicle(parsed.vehicleNumber);
  if (active) {
    record('duplicate-check', `Already parked at ${active.blockName} / ${active.slotId} since ${active.entryTime}`, 4, false);
    return {
      success: false,
      reason: 'ALREADY_PARKED',
      frameId,
      vehicleNumber: parsed.vehicleNumber,
      message: `${parsed.vehicleNumber} is already parked at ${active.blockName} / ${active.slotId}`,
      existingVehicle: active,
      ocr: summariseOcr(ocrResult),
      plateImage: plateImageDataUri(parsed.vehicleNumber),
      stages,
      startedAt,
      finishedAt: new Date(),
    };
  }
  record('duplicate-check', `${parsed.vehicleNumber} is not inside the campus`, 4);

  // 6 -------------------------------------------------------- slot allocation
  const slot = await assignSlot({ vehicleType: options.vehicleType || 'Car' });
  if (!slot) {
    record('slot-allocation', 'Parking is full - no empty slot available', 5, false);
    return {
      success: false,
      reason: 'PARKING_FULL',
      frameId,
      vehicleNumber: parsed.vehicleNumber,
      ocr: summariseOcr(ocrResult),
      plateImage: plateImageDataUri(parsed.vehicleNumber),
      stages,
      startedAt,
      finishedAt: new Date(),
    };
  }
  record('slot-allocation', `${slot.slotId} is free - closest to the main gate (${slot.distanceFromGateM} m)`, slot.allocationMs);

  // 7 ------------------------------------------------------------- database
  let vehicle = null;
  if (options.store !== false) {
    try {
      vehicle = await options.persist({
        vehicleNumber: parsed.vehicleNumber,
        slot,
        vehicleType: options.vehicleType || 'Car',
        ownerName: options.ownerName || 'Unknown owner (ANPR)',
        source: 'ANPR',
        confidence: ocrResult.confidence,
        plateImage: plateImageDataUri(parsed.vehicleNumber),
        cameraId: config.camera.id,
      });
    } catch (error) {
      // The bay was reserved above - give it back so it is not lost forever.
      await getStore().updateSlot(slot.slotId, {
        status: 'Empty',
        vehicleNumber: null,
        vehicleId: null,
        entryTime: null,
      });
      record('database', `Write failed: ${error.message} - ${slot.slotId} released again`, 6, false);
      const wrapped = new Error(error.message);
      wrapped.status = error.status || 500;
      throw wrapped;
    }
    record('database', `Saved ${vehicle.vehicleNumber} -> ${vehicle.blockName} / ${vehicle.slotId}`, 9);
  } else {
    record('database', 'Dry run - nothing written (store=false)', 1);
  }

  return {
    success: true,
    frameId,
    vehicleNumber: parsed.vehicleNumber,
    detection: {
      class: detection.vehicle.class,
      confidence: detection.vehicle.confidence,
      boundingBox: detection.vehicle.boundingBox,
    },
    plateRegion: plate.roi,
    ocr: summariseOcr(ocrResult),
    slot: slot.slotId,
    block: slot.blockName,
    entryTime: (vehicle && vehicle.entryTime) || startedAt,
    vehicle: vehicle || { vehicleNumber: parsed.vehicleNumber, slotId: slot.slotId, blockName: slot.blockName },
    plateImage: plateImageDataUri(parsed.vehicleNumber),
    stages,
    startedAt,
    finishedAt: new Date(),
  };
}

function summariseOcr(result) {
  return {
    text: result.text,
    repaired: result.repaired,
    confidence: result.confidence,
    engine: result.engine,
    degraded: Boolean(result.degraded),
    characters: (result.characters || []).map((c) => ({ char: c.char, raw: c.raw || c.char, confidence: c.confidence })),
  };
}

module.exports = { processCameraFrame, plateImageDataUri, STAGE_LABELS, slotLayout: layout };
