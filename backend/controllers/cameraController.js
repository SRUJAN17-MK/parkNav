'use strict';

const config = require('../config');
const { getStore } = require('../database');
const { asyncHandler } = require('../middleware/errorHandler');
const { processCameraFrame } = require('../services/anprService');
const parkingService = require('../services/parkingService');
const ocr = require('../../ai/ocr/ocrEngine');

/**
 * POST /api/camera/simulate-entry
 * Runs the whole pipeline: detect -> plate -> OCR -> validate -> allocate -> save.
 */
const simulateEntry = asyncHandler(async (req, res) => {
  const store = getStore();
  const body = req.body || {};

  if (body.plateHint && !ocr.isValidNumber(body.plateHint)) {
    return res.status(422).json({ success: false, message: `"${body.plateHint}" is not a valid Indian number plate` });
  }

  const report = await processCameraFrame({
    plateHint: body.plateHint,
    vehicleType: body.vehicleType || 'Car',
    ownerName: body.ownerName,
    store: body.store !== false,
    frameId: body.frameId,
    persist: (payload) =>
      parkingService.recordEntry({
        vehicleNumber: payload.vehicleNumber,
        vehicleType: payload.vehicleType,
        ownerName: payload.ownerName,
        source: payload.source,
        ocrConfidence: payload.confidence,
        plateImage: payload.plateImage,
        cameraId: payload.cameraId,
        // The ANPR pipeline already picked (and reserved) this bay.
        slotId: body.slotId || payload.slot.slotId,
      }),
  });

  await store.createEvent({
    type: report.success ? 'Entry' : 'Rejected',
    cameraId: config.camera.id,
    vehicleNumber: report.vehicleNumber || report.rawText || null,
    slotId: report.slot || null,
    blockName: report.block || null,
    confidence: report.ocr ? report.ocr.confidence : null,
    engine: report.ocr ? report.ocr.engine : 'simulated-motion-detector',
    message: report.success
      ? `${report.vehicleNumber} parked at ${report.block} / ${report.slot}`
      : `Entry rejected (${report.reason})`,
    pipeline: report.stages.map((s) => ({ stage: s.stage, detail: s.detail, ok: s.ok, ms: s.ms })),
    plateImage: report.plateImage || null,
  });

  res.status(report.success ? 201 : 200).json({ success: report.success, report });
});

/**
 * POST /api/camera/simulate-exit
 * Reads a plate (or takes slotId) and releases the slot.
 */
const simulateExit = asyncHandler(async (req, res) => {
  const store = getStore();
  const body = req.body || {};
  let vehicleNumber = body.plateHint || body.vehicleNumber;
  const stages = [];

  if (!vehicleNumber && !body.slotId) {
    const detection = await processCameraFrame({ store: false, plateHint: body.plateHint });
    vehicleNumber = detection.vehicleNumber;
    stages.push(
      { stage: 'camera', label: 'Entrance camera', detail: `${config.camera.id} - exit lane frame captured`, ok: true, ms: 10 },
      {
        stage: 'ocr',
        label: 'Optical character recognition',
        detail: `Plate read as ${vehicleNumber} (${detection.ocr ? detection.ocr.confidence : 0}% confidence)`,
        ok: Boolean(vehicleNumber),
        ms: detection.ocr ? detection.ocr.confidence : 120,
      },
    );
  }

  try {
    const result = await parkingService.recordExit({ vehicleNumber, slotId: body.slotId });
    stages.push({
      stage: 'slot-release',
      label: 'Slot release',
      detail: `${result.vehicle.slotId} is now EMPTY`,
      ok: true,
      ms: 8,
    });
    await store.createEvent({
      type: 'Exit',
      cameraId: config.camera.id,
      vehicleNumber: result.vehicle.vehicleNumber,
      slotId: result.vehicle.slotId,
      blockName: result.vehicle.blockName,
      message: result.message,
      pipeline: stages.map((s) => ({ stage: s.stage, detail: s.detail, ok: s.ok, ms: s.ms })),
    });
    return res.json({ success: true, report: { ...result, stages } });
  } catch (error) {
    await store.createEvent({
      type: 'Rejected',
      cameraId: config.camera.id,
      vehicleNumber: vehicleNumber || null,
      message: `Exit rejected: ${error.message}`,
      pipeline: [{ stage: 'slot-release', detail: error.message, ok: false, ms: 4 }],
    });
    return res.status(error.status || 400).json({ success: false, message: error.message, report: { stages } });
  }
});

/** POST /api/camera/ocr - read a plate from an uploaded base64 image. */
const readPlate = asyncHandler(async (req, res) => {
  const { image, plateHint, frameId } = req.body || {};
  if (!image && !plateHint) {
    return res.status(400).json({ success: false, message: 'Provide "image" (base64) or "plateHint"' });
  }
  const result = await ocr.readNumberPlate({ image, plateHint, frameId: frameId || `UPLOAD-${Date.now()}` });
  res.json({
    success: true,
    ocr: {
      text: result.text,
      repaired: result.repaired,
      confidence: result.confidence,
      engine: result.engine,
      degraded: Boolean(result.degraded),
      parsed: result.parsed,
    },
    plateImage: ocr.renderPlateSvg(result.repaired || result.text),
    engineStatus: ocr.engineStatus(),
  });
});

/** GET /api/camera/status - ANPR engine + camera info. */
const status = asyncHandler(async (req, res) => {
  const store = getStore();
  res.json({
    success: true,
    camera: {
      id: config.camera.id,
      location: config.camera.location,
      lane: 'Entry / Exit (single lane ANPR)',
      engine: ocr.engineStatus(),
    },
    recentEvents: (await store.listEvents()).slice(0, 15),
  });
});

module.exports = { simulateEntry, simulateExit, readPlate, status };
