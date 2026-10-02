'use strict';

/**
 * SmartPark - Dashboard statistics.
 * Every number shown on the dashboard is computed here from the live data.
 */

const { getStore } = require('../database');
const layout = require('../data/layout');
const { distancesFromWatchman } = require('./navigationService');

const DATE_RANGES = {
  today: () => startOfDay(new Date()),
  week: () => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - 6);
    return d;
  },
  month: () => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - 29);
    return d;
  },
};

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function rangeStart(range) {
  const key = String(range || 'today').toLowerCase();
  return (DATE_RANGES[key] || DATE_RANGES.today)();
}

async function getStats() {
  const store = getStore();
  const [slots, vehicles] = await Promise.all([store.listSlots(), store.listVehicles()]);

  const occupied = slots.filter((slot) => slot.status === 'Occupied');
  const empty = slots.filter((slot) => slot.status === 'Empty');
  const today = startOfDay(new Date());
  const now = Date.now();

  const enteredToday = vehicles.filter((v) => new Date(v.entryTime) >= today);
  const exitedToday = vehicles.filter((v) => v.exitTime && new Date(v.exitTime) >= today);
  const parked = vehicles.filter((v) => v.status === 'Parked');
  const longestStay = parked.reduce(
    (acc, v) => Math.max(acc, now - new Date(v.entryTime).getTime()),
    0,
  );

  const byBlock = layout.BLOCKS.map((block) => {
    const blockSlots = slots.filter((slot) => slot.blockId === block.id);
    const blockOccupied = blockSlots.filter((slot) => slot.status === 'Occupied');
    return {
      blockId: block.id,
      blockName: block.name,
      zone: block.zone,
      total: blockSlots.length,
      occupied: blockOccupied.length,
      empty: blockSlots.length - blockOccupied.length,
      occupancy: Math.round((blockOccupied.length / blockSlots.length) * 100),
      evSlots: blockSlots.filter((slot) => slot.type === 'ev').length,
      visitorSlots: blockSlots.filter((slot) => slot.type === 'visitor').length,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    totalSlots: slots.length,
    occupiedSlots: occupied.length,
    availableSlots: empty.length,
    totalVehicles: vehicles.length,
    vehiclesParked: parked.length,
    vehiclesToday: enteredToday.length,
    entriesToday: enteredToday.length,
    exitsToday: exitedToday.length,
    occupancyRate: slots.length ? Math.round((occupied.length / slots.length) * 100) : 0,
    averageStayMinutes: averageStay(vehicles),
    longestStayHours: Math.round((longestStay / 3600000) * 10) / 10,
    byBlock,
    recentEntries: [...enteredToday]
      .sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime))
      .slice(0, 8)
      .map(summarise),
    recentExits: [...exitedToday]
      .sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime))
      .slice(0, 8)
      .map(summarise),
    recentEvents: (await store.listEvents()).slice(0, 6),
  };
}

function averageStay(vehicles) {
  const done = vehicles.filter((v) => v.exitTime);
  if (!done.length) return 0;
  const total = done.reduce((sum, v) => sum + (new Date(v.exitTime) - new Date(v.entryTime)), 0);
  return Math.round(total / done.length / 60000);
}

function summarise(vehicle) {
  return {
    vehicleNumber: vehicle.vehicleNumber,
    ownerName: vehicle.ownerName,
    ownerFlat: vehicle.ownerFlat,
    vehicleType: vehicle.vehicleType,
    blockName: vehicle.blockName,
    slotId: vehicle.slotId,
    entryTime: vehicle.entryTime,
    exitTime: vehicle.exitTime,
    status: vehicle.status,
    source: vehicle.source,
  };
}

/** Vehicles inside a time window - powers the history page filters. */
async function getHistory(options = {}) {
  const store = getStore();
  const from = options.from ? new Date(options.from) : rangeStart(options.range);
  const vehicles = await store.listVehicles();
  const q = options.q ? String(options.q).toUpperCase() : '';

  return vehicles
    .filter((vehicle) => {
      const entry = new Date(vehicle.entryTime);
      if (entry < from) return false;
      if (options.status && vehicle.status !== options.status) return false;
      if (options.blockId && vehicle.blockId !== String(options.blockId).toUpperCase()) return false;
      if (options.slotId && vehicle.slotId !== String(options.slotId).toUpperCase()) return false;
      if (q) {
        return (
          vehicle.vehicleNumber.includes(q) ||
          (vehicle.ownerName || '').toUpperCase().includes(q) ||
          (vehicle.slotId || '').includes(q) ||
          (vehicle.blockName || '').toUpperCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime))
    .map((vehicle) => ({ ...summarise(vehicle), stayedMinutes: stayMinutes(vehicle) }));
}

function stayMinutes(vehicle) {
  const end = vehicle.exitTime ? new Date(vehicle.exitTime) : new Date();
  return Math.max(0, Math.round((end - new Date(vehicle.entryTime)) / 60000));
}

/** Watchman search: number / slot / block / owner, all partial matches. */
async function search(query, options = {}) {
  const store = getStore();
  const q = String(query || '').trim().toUpperCase();
  if (!q) return { query: q, total: 0, parked: [], history: [] };

  const vehicles = await store.listVehicles();
  const slots = await store.listSlots();

  const matchesVehicle = (vehicle) =>
    vehicle.vehicleNumber.includes(q) ||
    (vehicle.ownerName || '').toUpperCase().includes(q) ||
    (vehicle.ownerFlat || '').toUpperCase().includes(q) ||
    (vehicle.brand || '').toUpperCase().includes(q);

  const parked = vehicles
    .filter((v) => v.status === 'Parked' && matchesVehicle(v))
    .map((v) => {
      const slot = slots.find((s) => s.slotId === v.slotId);
      return { ...summarise(v), stayedMinutes: stayMinutes(v), slotStatus: slot ? slot.status : null };
    });

  const slotMatches = slots
    .filter((slot) => slot.slotId === q || (options.blockId && slot.blockId === String(options.blockId).toUpperCase() && slot.slotId.includes(q)))
    .map((slot) => {
      const vehicle = vehicles.find((v) => v.vehicleNumber === slot.vehicleNumber && v.status === 'Parked');
      return {
        slotId: slot.slotId,
        blockId: slot.blockId,
        blockName: slot.blockName,
        status: slot.status,
        type: slot.type,
        vehicleNumber: slot.vehicleNumber,
        vehicle: vehicle ? summarise(vehicle) : null,
      };
    });

  const blockMatches = layout.BLOCKS.filter((block) => block.name.toUpperCase().includes(q) || block.id === q).map((block) => {
    const blockSlots = slots.filter((slot) => slot.blockId === block.id);
    return {
      blockId: block.id,
      blockName: block.name,
      zone: block.zone,
      total: blockSlots.length,
      occupied: blockSlots.filter((slot) => slot.status === 'Occupied').length,
      slots: blockSlots,
    };
  });

  const history = vehicles
    .filter((v) => v.status === 'Exited' && matchesVehicle(v))
    .slice(0, 15)
    .map((v) => ({ ...summarise(v), stayedMinutes: stayMinutes(v) }));

  return {
    query: q,
    total: parked.length + slotMatches.length + blockMatches.length,
    parked,
    slots: slotMatches,
    blocks: blockMatches,
    history,
    distances: distancesFromWatchman(),
  };
}

module.exports = { getStats, getHistory, search, summarise, rangeStart, stayMinutes, startOfDay, DATE_RANGES };
