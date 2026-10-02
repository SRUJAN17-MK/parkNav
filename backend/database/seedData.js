'use strict';

/**
 * Deterministic demo data for SmartPark.
 *
 * The numbers are reproducible (seeded PRNG) so the dashboard always shows the
 * same picture on a fresh install:
 *    Total slots      48
 *    Occupied         31
 *    Available        17
 *    Vehicles today   42   (31 still parked + 11 already exited)
 */

const bcrypt = require('bcryptjs');

const layout = require('../data/layout');

/** mulberry32 - tiny deterministic PRNG. */
function createRandom(seed = 20240517) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OWNERS = [
  ['Rahul Sharma', 'A-1201', '+91 98450 11223'],
  ['Ananya Iyer', 'A-1402', '+91 98450 11345'],
  ['Karthik Reddy', 'A-0904', '+91 98450 12789'],
  ['Sneha Nair', 'A-1103', '+91 98450 14567'],
  ['Vikram Rao', 'B-0705', '+91 98450 15678'],
  ['Deepa Menon', 'B-0302', '+91 98450 16789'],
  ['Arjun Patel', 'B-1201', '+91 98450 17890'],
  ['Meera Krishnan', 'B-1504', '+91 98450 18901'],
  ['Rohit Verma', 'C-0603', '+91 98450 19012'],
  ['Priya Deshmukh', 'C-0802', '+91 98450 20123'],
  ['Sandeep Joshi', 'C-1005', '+91 98450 21234'],
  ['Nikhil Gupta', 'C-1401', '+91 98450 22345'],
  ['Fatima Ansari', 'D-0404', '+91 98450 23456'],
  ['Ramesh Babu', 'D-0203', '+91 98450 24567'],
  ['Kavya Shetty', 'D-1102', '+91 98450 25678'],
  ['Aditya Rao', 'D-1305', '+91 98450 26789'],
  ['Nagaraj M', 'A-0501', '+91 98450 27890'],
  ['Shreya Pillai', 'A-0604', '+91 98450 28901'],
  ['Manjunath K', 'B-0902', '+91 98450 29012'],
  ['Divya Prakash', 'B-1103', '+91 98450 30123'],
  ['Harish Bhat', 'C-0305', '+91 98450 31234'],
  ['Lakshmi S', 'C-0501', '+91 98450 32345'],
  ['Praveen Kumar', 'D-0701', '+91 98450 33456'],
  ['Aishwarya N', 'D-0904', '+91 98450 34567'],
  ['Girish Bhat', 'A-0803', '+91 98450 35678'],
  ['Swathi Rao', 'A-1002', '+91 98450 36789'],
  ['Imran Shaikh', 'B-0605', '+91 98450 37890'],
  ['Chaitanya M', 'B-0801', '+91 98450 38901'],
  ['Preeti Sharma', 'C-1204', '+91 98450 39012'],
  ['Vivek Chandra', 'C-1402', '+91 98450 40123'],
  ['Sameer Khan', 'D-0503', '+91 98450 41234'],
  ['Nandini S', 'D-1001', '+91 98450 42345'],
  ['Yash Chauhan', 'A-0202', '+91 98450 43456'],
  ['Bhavana R', 'A-0405', '+91 98450 44567'],
  ['Suman Patil', 'B-0404', '+91 98450 45678'],
  ['Zoya Khan', 'C-0102', '+91 98450 46789'],
  ['Kiran Hegde', 'C-0203', '+91 98450 47890'],
  ['Akhil Suresh', 'D-0802', '+91 98450 48901'],
  ['Rithika J', 'D-1204', '+91 98450 49012'],
  ['Om Prakash', 'A-1603', '+91 98450 50123'],
];

const PLATE_SERIES = ['KA', 'KA', 'KA', 'KA', 'KA', 'KA', 'MH', 'TN', 'AP', 'TS', 'KL', 'GJ'];
const PLATE_RTO = ['01', '02', '03', '04', '05', '09', '10', '20', '25', '53'];
const VEHICLE_MODELS = [
  ['Maruti Swift', 'White', 'Hatchback'],
  ['Hyundai i20', 'Silver', 'Hatchback'],
  ['Honda City', 'Black', 'Sedan'],
  ['Toyota Innova', 'Silver', 'SUV'],
  ['Tata Nexon', 'Blue', 'SUV'],
  ['Maruti Baleno', 'Red', 'Hatchback'],
  ['Kia Seltos', 'White', 'SUV'],
  ['Mahindra XUV700', 'Grey', 'SUV'],
  ['Tata Tiago', 'White', 'Hatchback'],
  ['Hyundai Creta', 'Blue', 'SUV'],
  ['Renault Kwid', 'Yellow', 'Hatchback'],
  ['MG Hector', 'Black', 'SUV'],
  ['Tata Nexon EV', 'White', 'EV'],
  ['Mahindra eVerito', 'Blue', 'EV'],
];

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function makePlate(random, index) {
  const series = PLATE_SERIES[index % PLATE_SERIES.length];
  const rto = PLATE_RTO[(index * 3) % PLATE_RTO.length];
  const mid = LETTERS[Math.floor(random() * LETTERS.length)];
  const last = LETTERS[Math.floor(random() * LETTERS.length)];
  const serial = String(1000 + ((index * 137) % 8999)).padStart(4, '0');
  return `${series}${rto}${mid}${last}${serial}`;
}

function startOfToday(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Chooses which slots are occupied so that every block has a believable mix.
 * 31 of 48 slots occupied, spread evenly (A:8 B:8 C:8 D:7).
 */
function pickOccupiedSlots() {
  const random = createRandom(991);
  const quota = { A: 8, B: 8, C: 8, D: 7 };
  const chosen = [];
  layout.BLOCKS.forEach((block) => {
    const slots = block.slots.slice();
    for (let i = slots.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    chosen.push(...slots.slice(0, quota[block.id]));
  });
  return chosen;
}

function buildVehicle({ number, owner, block, slot, entryTime, exitTime, source, confidence, random }) {
  const model = VEHICLE_MODELS[Math.floor(random() * VEHICLE_MODELS.length)];
  return {
    vehicleNumber: number,
    ownerName: owner[0],
    ownerFlat: `${block.id}-${owner[1]}`,
    ownerPhone: owner[2],
    brand: model[0],
    color: model[1],
    vehicleType: source === 'ANPR' && random() > 0.92 ? 'EV' : model[2],
    blockId: block.id,
    blockName: block.name,
    slotId: slot.id,
    entryTime,
    exitTime: exitTime || null,
    status: exitTime ? 'Exited' : 'Parked',
    source,
    cameraId: 'CAM-GATE-01',
    ocrConfidence: confidence,
    plateImage: null,
    notes: '',
  };
}

function buildSeed({ now = new Date() } = {}) {
  const random = createRandom(4242);
  const today = startOfToday(now);
  const users = [
    {
      username: 'watchman',
      // Demo credentials -> watchman / watch123
      password: bcrypt.hashSync('watch123', 10),
      name: 'Ramesh Kumar',
      role: 'watchman',
      phone: '+91 90000 11111',
      shift: 'Day (8 AM - 8 PM)',
    },
    {
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      name: 'SmartPark Admin',
      role: 'admin',
      phone: '+91 90000 22222',
      shift: 'All',
    },
  ];

  const occupied = pickOccupiedSlots();
  const vehicles = [];
  let plateIndex = 0;
  let ownerIndex = 0;

  // Today's schedule is relative to the current time so the dashboard always
  // shows 42 vehicles for today, whenever the demo is run.
  const elapsedMs = Math.max(now.getTime() - today.getTime(), 2 * 60 * 1000);
  const todayAt = (fraction) =>
    new Date(Math.min(today.getTime() + elapsedMs * fraction, now.getTime() - 1000));

  // 1) 31 vehicles currently parked (still inside the campus)
  occupied.forEach((slot, i) => {
    const block = layout.getBlock(slot.blockId);
    const owner = OWNERS[ownerIndex % OWNERS.length];
    ownerIndex += 1;
    const entryTime = todayAt((i + 1) / 33);
    vehicles.push(
      buildVehicle({
        number: makePlate(random, plateIndex),
        owner,
        block,
        slot,
        entryTime,
        source: plateIndex % 4 === 0 ? 'Manual' : 'ANPR',
        confidence: 88 + Math.floor(random() * 11),
        random,
      }),
    );
    plateIndex += 1;
  });

  // 2) 11 vehicles that entered and left today (keeps "vehicles today" = 42)
  const freeSlots = layout.SLOTS.filter((s) => !occupied.some((o) => o.id === s.id));
  for (let i = 0; i < 11; i += 1) {
    const slot = freeSlots[(i * 3) % freeSlots.length];
    const block = layout.getBlock(slot.blockId);
    const owner = OWNERS[ownerIndex % OWNERS.length];
    ownerIndex += 1;
    // Entries land in the second half of the day so far, leaving room for the exit.
    const latestEntry = now.getTime() - 60 * 1000;
    const entryTime = new Date(Math.min(todayAt(0.55 + (i / 11) * 0.3).getTime(), latestEntry));
    const window = now.getTime() - entryTime.getTime();
    const stay = Math.max(30 * 1000, Math.round(window * (0.25 + random() * 0.4)));
    const exitTime = new Date(Math.min(entryTime.getTime() + stay, now.getTime() - 5 * 1000));
    if (exitTime <= entryTime) continue;
    vehicles.push(
      buildVehicle({
        number: makePlate(random, plateIndex),
        owner,
        block,
        slot,
        entryTime,
        exitTime,
        source: plateIndex % 5 === 0 ? 'Manual' : 'ANPR',
        confidence: 90 + Math.floor(random() * 9),
        random,
      }),
    );
    plateIndex += 1;
  }

  // 3) Older sessions for the "This week / This month" history filters
  const historyDays = [1, 2, 3, 4, 5, 6, 8, 11, 14, 17, 20, 24, 28];
  historyDays.forEach((daysAgo, i) => {
    const slot = layout.SLOTS[(i * 5 + 2) % layout.SLOTS.length];
    const block = layout.getBlock(slot.blockId);
    const owner = OWNERS[ownerIndex % OWNERS.length];
    ownerIndex += 1;
    const entryTime = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000 + (8 + (i % 9)) * 60 * 60 * 1000);
    const exitTime = new Date(entryTime.getTime() + (2 + (i % 7)) * 60 * 60 * 1000);
    if (entryTime > now) return;
    vehicles.push(
      buildVehicle({
        number: makePlate(random, plateIndex),
        owner,
        block,
        slot,
        entryTime,
        exitTime: exitTime > now ? null : exitTime,
        source: plateIndex % 6 === 0 ? 'Manual' : 'ANPR',
        confidence: 86 + Math.floor(random() * 13),
        random,
      }),
    );
    plateIndex += 1;
  });

  return { users, vehicles, createdAt: now };
}

function buildSlots(vehicles) {
  const activeBySlot = new Map();
  vehicles.filter((v) => v.status === 'Parked').forEach((v) => activeBySlot.set(v.slotId, v));

  return layout.SLOTS.map((slot) => {
    const vehicle = activeBySlot.get(slot.id) || null;
    return {
      slotId: slot.id,
      blockId: slot.blockId,
      blockName: slot.blockName,
      row: slot.row,
      col: slot.col,
      type: slot.type,
      status: vehicle ? 'Occupied' : 'Empty',
      vehicleNumber: vehicle ? vehicle.vehicleNumber : null,
      vehicleId: vehicle ? vehicle.vehicleNumber : null,
      entryTime: vehicle ? vehicle.entryTime : null,
      cvOccupied: null,
      lastSeenAt: null,
    };
  });
}

module.exports = { buildSeed, buildSlots, createRandom, OWNERS, VEHICLE_MODELS, makePlate };
