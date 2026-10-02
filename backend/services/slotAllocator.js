'use strict';

/**
 * SmartPark - Automatic parking slot allocation.
 *
 * Real deployments add a second stage: a camera per parking row that reports
 * whether a bay is physically free (cvOccupied). Here the slot status stored in
 * the database is the source of truth, and the *closest free slot to the main
 * gate* is chosen using Dijkstra's algorithm on the road graph - so drivers
 * never have to drive deep into the campus.
 *
 * Type preference keeps special bays free:
 *   standard (0 m penalty)  <  visitor (+6 m)  <  EV (+8 m)
 * unless the incoming vehicle itself needs that bay.
 */

const { getStore } = require('../database');
const { GRAPH, NODES, getBlock, SLOTS } = require('../data/layout');
const { dijkstra } = require('./pathfinding');

const TYPE_PENALTY = { standard: 0, visitor: 6, ev: 8 };

// Single source shortest paths from the main gate (computed once at startup).
let cachedGateDistances = null;

/** Shortest distance (metres) from the main gate to every parking slot. */
function gateDistances() {
  if (!cachedGateDistances) {
    const fromGate = dijkstra(GRAPH, NODES.gate).distances;
    // Indexed by slot id ("A-01") *and* by graph node id ("SLOT-A-01") so
    // callers can use whichever key they already hold.
    cachedGateDistances = SLOTS.reduce((acc, slot) => {
      const distance = fromGate[slot.nodeId];
      acc[slot.id] = distance;
      acc[slot.nodeId] = distance;
      return acc;
    }, {});
  }
  return cachedGateDistances;
}

function preferenceOrder(vehicleType) {
  if (vehicleType === 'EV') return ['ev', 'standard', 'visitor'];
  if (vehicleType === 'Visitor') return ['visitor', 'standard', 'ev'];
  return ['standard', 'visitor', 'ev'];
}

async function listEmptySlots() {
  const store = getStore();
  const slots = await store.listSlots();
  return slots.filter((slot) => slot.status === 'Empty');
}

/**
 * Finds the best free slot for an arriving vehicle.
 *
 * @param {object} [options]
 * @param {string} [options.vehicleType]
 * @param {string} [options.blockId]   restrict the search to one block
 * @returns {Promise<null|{slotId:string, blockId:string, blockName:string,
 *   distanceFromGateM:number, type:string, reason:string, allocationMs:number}>}
 */
async function findNearestAvailableSlot(options = {}) {
  const started = Date.now();
  const empty = await listEmptySlots();
  if (!empty.length) return null;

  const distances = gateDistances();
  const order = preferenceOrder(options.vehicleType || 'Car');
  const rank = Object.fromEntries(order.map((type, index) => [type, index]));

  const candidates = empty
    .filter((slot) => !options.blockId || slot.blockId === options.blockId)
    .map((slot) => {
      const nodeId = `SLOT-${slot.slotId}`;
      const distance = distances[nodeId] ?? Number.MAX_SAFE_INTEGER;
      const penalty = TYPE_PENALTY[slot.type] ?? 0;
      return { slot, distance, penalty, score: distance + penalty };
    })
    .filter((c) => c.distance !== Number.MAX_SAFE_INTEGER)
    .sort((a, b) => a.score - b.score || a.slot.slotId.localeCompare(b.slot.slotId));

  if (!candidates.length) return null;
  const best = candidates[0];
  const block = getBlock(best.slot.blockId);
  const round = (n) => Math.round(n * 10) / 10;
  return {
    slotId: best.slot.slotId,
    blockId: best.slot.blockId,
    blockName: block ? block.name : best.slot.blockName,
    type: best.slot.type,
    distanceFromGateM: round(best.distance),
    typePenaltyM: best.penalty,
    // The allocator minimises distance + type penalty, not distance alone.
    score: round(best.score),
    alternatives: candidates.slice(1, 4).map((c) => ({ slotId: c.slot.slotId, distanceFromGateM: round(c.distance), score: round(c.score) })),
    reason: best.penalty
      ? `closest free slot (${Math.round(best.distance)} m from gate, ${best.slot.type} bay preferred by proximity)`
      : `closest free standard slot to the main gate (${Math.round(best.distance)} m)`,
    allocationMs: Date.now() - started,
  };
}

/**
 * Finds and reserves a slot in one step (used by the ANPR pipeline).
 */
async function assignSlot(options = {}) {
  const candidate = await findNearestAvailableSlot(options);
  if (!candidate) return null;

  const store = getStore();
  const reserved = await store.updateSlot(candidate.slotId, {
    status: 'Occupied',
    vehicleNumber: null,
    vehicleId: null,
    entryTime: null,
  });
  return { ...candidate, reservedAt: reserved ? new Date().toISOString() : null };
}

module.exports = { findNearestAvailableSlot, assignSlot, listEmptySlots, gateDistances, TYPE_PENALTY };
