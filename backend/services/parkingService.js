'use strict';

/**
 * SmartPark - Parking operations.
 *
 *   recordEntry()  a vehicle enters: reserve a slot, store the session
 *   recordExit()   a vehicle leaves: close the session, release the slot
 *
 * Both operations keep the vehicle collection and the slot collection in sync.
 */

const config = require('../config');
const { getStore } = require('../database');
const layout = require('../data/layout');
const { findNearestAvailableSlot } = require('./slotAllocator');
const { isValidNumber, normalise } = require('../../ai/ocr/plateParser');

function nowIso() {
  return new Date().toISOString();
}

async function findActiveVehicle(vehicleNumber) {
  const store = getStore();
  const vehicle = await store.findVehicleByNumber(vehicleNumber);
  if (vehicle && vehicle.status === 'Parked') return vehicle;
  const all = await store.listVehicles();
  return all.find((v) => v.vehicleNumber === normalise(vehicleNumber) && v.status === 'Parked') || null;
}

async function assertVehicleNumber(vehicleNumber) {
  const value = normalise(vehicleNumber);
  if (!value) {
    const error = new Error('vehicleNumber is required');
    error.status = 400;
    throw error;
  }
  if (!isValidNumber(value)) {
    const error = new Error(`"${value}" is not a valid Indian number plate (expected SS RR LL NNNN, e.g. KA01AB1234)`);
    error.status = 422;
    throw error;
  }
  return value;
}

/**
 * Records a vehicle entry.
 *
 * @param {object} input
 * @param {string} input.vehicleNumber
 * @param {string} [input.slotId]        manual assignment (otherwise auto-allocate)
 * @param {string} [input.vehicleType]
 * @param {string} [input.ownerName]
 * @param {string} [input.ownerFlat]
 * @param {string} [input.ownerPhone]
 * @param {string} [input.source]        ANPR | Manual | Demo
 * @param {number} [input.ocrConfidence]
 * @param {string} [input.plateImage]
 * @returns {Promise<{vehicle:object, slot:object, allocated:boolean, message:string}>}
 */
async function recordEntry(input) {
  const store = getStore();
  const vehicleNumber = await assertVehicleNumber(input.vehicleNumber);

  const existing = await findActiveVehicle(vehicleNumber);
  if (existing) {
    const error = new Error(`${vehicleNumber} is already parked at ${existing.blockName} / ${existing.slotId}`);
    error.status = 409;
    error.current = existing;
    throw error;
  }

  let slot = null;
  let allocated = false;
  if (input.slotId) {
    slot = await store.findSlot(input.slotId);
    if (!slot) {
      const error = new Error(`Unknown parking slot "${input.slotId}"`);
      error.status = 404;
      throw error;
    }
    // "Occupied with no vehicle" means the allocator already reserved it for
    // this incoming vehicle, so it is safe to complete the assignment.
    const heldByAnotherCar = slot.status === 'Occupied' && Boolean(slot.vehicleNumber);
    if (heldByAnotherCar) {
      const error = new Error(`${slot.slotId} is already occupied by ${slot.vehicleNumber}`);
      error.status = 409;
      throw error;
    }
  } else {
    const candidate = await findNearestAvailableSlot({ vehicleType: input.vehicleType || 'Car' });
    if (!candidate) {
      const error = new Error('Parking is full - no empty slot available');
      error.status = 409;
      throw error;
    }
    slot = await store.findSlot(candidate.slotId);
    allocated = true;
  }

  const entryTime = input.entryTime ? new Date(input.entryTime) : new Date();
  const block = layout.getBlock(slot.blockId);

  const vehicle = await store.createVehicle({
    vehicleNumber,
    ownerName: input.ownerName || 'Unknown owner',
    ownerFlat: input.ownerFlat || '',
    ownerPhone: input.ownerPhone || '',
    brand: input.brand || '',
    color: input.color || '',
    vehicleType: input.vehicleType || 'Car',
    blockId: slot.blockId,
    blockName: block ? block.name : slot.blockName,
    slotId: slot.slotId,
    entryTime: entryTime.toISOString(),
    exitTime: null,
    status: 'Parked',
    source: input.source || 'Manual',
    cameraId: input.cameraId || config.camera.id,
    ocrConfidence: input.ocrConfidence ?? null,
    plateImage: input.plateImage || null,
    notes: input.notes || '',
  });

  const updatedSlot = await store.updateSlot(slot.slotId, {
    status: 'Occupied',
    vehicleNumber,
    vehicleId: vehicle.id || vehicleNumber,
    entryTime: entryTime.toISOString(),
  });

  return {
    vehicle,
    slot: updatedSlot,
    allocated,
    message: `${vehicleNumber} parked at ${vehicle.blockName} / ${vehicle.slotId}`,
  };
}

/**
 * Records a vehicle exit (by number or by slot).
 *
 * @param {object} input
 * @param {string} [input.vehicleNumber]
 * @param {string} [input.slotId]
 * @param {string} [input.exitTime]
 * @returns {Promise<{vehicle:object, slot:object, message:string}>}
 */
async function recordExit(input) {
  const store = getStore();
  let vehicle = null;

  if (input.vehicleNumber) {
    const number = normalise(input.vehicleNumber);
    vehicle = await findActiveVehicle(number);
    if (!vehicle) {
      const anyRecord = await store.findVehicleByNumber(number);
      const error = new Error(
        anyRecord
          ? `${number} already left the campus at ${new Date(anyRecord.exitTime).toLocaleString('en-IN')}`
          : `${number} is not in the parking database`,
      );
      error.status = 404;
      throw error;
    }
  } else if (input.slotId) {
    const slot = await store.findSlot(input.slotId);
    if (!slot) {
      const error = new Error(`Unknown parking slot "${input.slotId}"`);
      error.status = 404;
      throw error;
    }
    if (slot.status === 'Empty') {
      const error = new Error(`${slot.slotId} is already empty`);
      error.status = 409;
      throw error;
    }
    vehicle = await findActiveVehicle(slot.vehicleNumber);
    if (!vehicle) {
      const error = new Error(`Slot ${slot.slotId} references ${slot.vehicleNumber} but no parked session was found`);
      error.status = 409;
      throw error;
    }
  } else {
    const error = new Error('Provide vehicleNumber or slotId');
    error.status = 400;
    throw error;
  }

  const exitTime = input.exitTime ? new Date(input.exitTime) : new Date();
  const updatedVehicle = await store.updateVehicleByNumber(vehicle.vehicleNumber, {
    exitTime: exitTime.toISOString(),
    status: 'Exited',
  });

  const updatedSlot = await store.updateSlot(vehicle.slotId, {
    status: 'Empty',
    vehicleNumber: null,
    vehicleId: null,
    entryTime: null,
  });

  const durationMin = Math.round((exitTime - new Date(vehicle.entryTime)) / 60000);
  return {
    vehicle: updatedVehicle,
    slot: updatedSlot,
    stayedMinutes: durationMin,
    message: `${vehicle.vehicleNumber} exited from ${vehicle.slotId} - slot released (${durationMin} min stay)`,
  };
}

/** Full vehicle record enriched with slot + navigation context. */
async function getVehicleDetail(vehicleNumber) {
  const store = getStore();
  const number = normalise(vehicleNumber);
  const vehicles = await store.listVehicles();
  const vehicle = vehicles.find((v) => v.vehicleNumber === number);
  if (!vehicle) return null;

  const slot = await store.findSlot(vehicle.slotId);
  return {
    ...vehicle,
    slot: slot
      ? {
          slotId: slot.slotId,
          status: slot.status,
          type: slot.type,
          blockName: slot.blockName,
          vehicleNumber: slot.vehicleNumber,
        }
      : null,
  };
}

module.exports = { recordEntry, recordExit, getVehicleDetail, findActiveVehicle, assertVehicleNumber, nowIso };
