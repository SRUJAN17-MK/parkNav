'use strict';

const { getStore } = require('../database');
const layout = require('../data/layout');
const { asyncHandler } = require('../middleware/errorHandler');
const { distancesFromWatchman } = require('../services/navigationService');
const { gateDistances, TYPE_PENALTY, findNearestAvailableSlot } = require('../services/slotAllocator');

/**
 * GET /api/parking/map
 * Everything the frontend needs to draw the whole campus:
 * canvas, blocks, slots, roads, landmarks and the navigation graph.
 */
const getMap = asyncHandler(async (req, res) => {
  const store = getStore();
  const [slots, events] = await Promise.all([store.listSlots(), store.listEvents()]);
  const distances = distancesFromWatchman();
  const fromGate = gateDistances();

  res.json({
    success: true,
    map: {
      canvas: layout.CANVAS,
      metersPerUnit: layout.METERS_PER_UNIT,
      title: 'Sunrise Apartments - Parking Layout',
      blocks: layout.BLOCKS.map((block) => ({
        id: block.id,
        name: block.name,
        zone: block.zone,
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
        titleHeight: block.titleHeight,
        aisleX: block.aisleX,
        leftLaneX: block.leftLaneX,
        rightLaneX: block.rightLaneX,
        corridorY: block.corridorY,
        entryY: block.entryY,
        slotCount: block.slots.length,
      })),
      roads: layout.ROADS,
      landmarks: layout.LANDMARKS,
      slots: slots
        .map((slot) => {
          const geo = layout.getSlot(slot.slotId);
          return {
            ...geo,
            slotId: slot.slotId,
            status: slot.status,
            type: slot.type,
            vehicleNumber: slot.vehicleNumber,
            entryTime: slot.entryTime,
            distanceFromWatchmanM: distances[slot.slotId] ?? null,
        distanceFromGateM: fromGate[slot.slotId] ?? null,
        typePenaltyM: TYPE_PENALTY[slot.type] ?? 0,
      };
        })
        .sort((a, b) => a.id.localeCompare(b.id)),
      graph: {
        nodes: layout.GRAPH.nodes,
        edges: layout.GRAPH.edges,
      },
      totals: {
        slots: slots.length,
        occupied: slots.filter((s) => s.status === 'Occupied').length,
        empty: slots.filter((s) => s.status === 'Empty').length,
      },
    },
    cameraEvents: events.slice(0, 12),
    generatedAt: new Date().toISOString(),
  });
});

/** GET /api/parking/slots?block=A&status=Empty&q=A-1 */
const getSlots = asyncHandler(async (req, res) => {
  const store = getStore();
  const { block, status, q, type } = req.query;
  const slots = await store.listSlots();
  const distances = distancesFromWatchman();
  const fromGate = gateDistances();
  const query = q ? String(q).toUpperCase() : '';

  const filtered = slots
    .filter((slot) => (block ? slot.blockId === String(block).toUpperCase() : true))
    .filter((slot) => (status ? slot.status === String(status) : true))
    .filter((slot) => (type ? slot.type === String(type) : true))
    .filter((slot) => (query ? slot.slotId.includes(query) || (slot.vehicleNumber || '').includes(query) : true))
    .map((slot) => {
      const geo = layout.getSlot(slot.slotId);
      return {
        ...geo,
        slotId: slot.slotId,
        status: slot.status,
        type: slot.type,
        vehicleNumber: slot.vehicleNumber,
        entryTime: slot.entryTime,
        lastSeenAt: slot.lastSeenAt,
        distanceFromWatchmanM: distances[slot.slotId] ?? null,
        distanceFromGateM: fromGate[slot.slotId] ?? null,
        typePenaltyM: TYPE_PENALTY[slot.type] ?? 0,
      };
    });

  res.json({
    success: true,
    total: filtered.length,
    occupied: filtered.filter((s) => s.status === 'Occupied').length,
    empty: filtered.filter((s) => s.status === 'Empty').length,
    slots: filtered,
  });
});

/** GET /api/parking/blocks */
const getBlocks = asyncHandler(async (req, res) => {
  const store = getStore();
  const slots = await store.listSlots();
  res.json({
    success: true,
    blocks: layout.BLOCKS.map((block) => {
      const blockSlots = slots.filter((slot) => slot.blockId === block.id);
      const occupied = blockSlots.filter((slot) => slot.status === 'Occupied').length;
      return {
        id: block.id,
        name: block.name,
        zone: block.zone,
        total: blockSlots.length,
        occupied,
        empty: blockSlots.length - occupied,
        occupancy: Math.round((occupied / blockSlots.length) * 100),
      };
    }),
  });
});

/** GET /api/parking/slots/:slotId */
const getSlot = asyncHandler(async (req, res) => {
  const store = getStore();
  const slot = await store.findSlot(req.params.slotId);
  if (!slot) return res.status(404).json({ success: false, message: `Unknown slot ${req.params.slotId}` });
  const geo = layout.getSlot(slot.slotId);
  const vehicles = await store.listVehicles();
  const session = vehicles.find((v) => v.vehicleNumber === slot.vehicleNumber && v.status === 'Parked');
  res.json({
    success: true,
    slot: { ...geo, ...slot, vehicle: session || null },
    distanceFromWatchmanM: distancesFromWatchman()[slot.slotId] ?? null,
  });
});

/** GET /api/parking/next-available */
const getNextAvailable = asyncHandler(async (req, res) => {
  const candidate = await findNearestAvailableSlot({ vehicleType: req.query.vehicleType || 'Car' });
  res.json({ success: true, slot: candidate });
});

module.exports = { getMap, getSlots, getBlocks, getSlot, getNextAvailable };
