'use strict';

const { getStore } = require('../database');
const layout = require('../data/layout');
const { asyncHandler } = require('../middleware/errorHandler');
const { getStats, getHistory, search } = require('../services/statsService');
const parkingService = require('../services/parkingService');

/** GET /api/dashboard/stats */
const stats = asyncHandler(async (req, res) => {
  const store = getStore();
  const data = await getStats();
  const events = await store.listEvents();
  res.json({ success: true, stats: { ...data, recentEvents: events.slice(0, 8) } });
});

/** GET /api/vehicles/search?q=KA01AB1234 */
const searchVehicles = asyncHandler(async (req, res) => {
  const result = await search(req.query.q, { blockId: req.query.block });
  res.json({ success: true, ...result });
});

/** GET /api/vehicles/:vehicleNumber - full detail + navigation context. */
const getVehicle = asyncHandler(async (req, res) => {
  const vehicle = await parkingService.getVehicleDetail(req.params.vehicleNumber);
  if (!vehicle) {
    return res.status(404).json({ success: false, message: `${req.params.vehicleNumber.toUpperCase()} is not in the parking database` });
  }
  const block = layout.getBlock(vehicle.blockId);
  res.json({
    success: true,
    vehicle: {
      ...vehicle,
      zone: block ? block.zone : null,
      slotPosition: block
        ? { row: (layout.getSlot(vehicle.slotId) || {}).row + 1, column: (layout.getSlot(vehicle.slotId) || {}).col + 1 }
        : null,
    },
  });
});

/** GET /api/vehicles?range=today|week|month&status=Parked&block=A&q= */
const listVehicles = asyncHandler(async (req, res) => {
  const rows = await getHistory(req.query);
  res.json({
    success: true,
    total: rows.length,
    range: req.query.range || 'today',
    vehicles: rows,
  });
});

/** POST /api/vehicles/entry - manual entry (no camera). */
const createEntry = asyncHandler(async (req, res) => {
  const result = await parkingService.recordEntry({ ...req.body, source: req.body.source || 'Manual' });
  res.status(201).json({ success: true, ...result });
});

/** POST /api/vehicles/exit - by vehicle number or by slot. */
const createExit = asyncHandler(async (req, res) => {
  const result = await parkingService.recordExit(req.body);
  res.json({ success: true, ...result });
});

module.exports = { stats, searchVehicles, getVehicle, listVehicles, createEntry, createExit };
