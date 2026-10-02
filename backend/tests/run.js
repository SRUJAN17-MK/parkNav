'use strict';

/**
 * SmartPark - end to end test suite.
 *
 *   npm test
 *
 * Covers the 12 flows required by the project brief:
 *   1 login            7 vehicle search      10 navigation
 *   2 dashboard        8 map display         11 vehicle exit
 *   3 vehicle entry    9 route calculation   12 slot becomes available
 *   4 OCR simulation   5 slot assignment
 *   6 status update    (6) parking status
 *
 * Runs against a throwaway database (JSON store) on an ephemeral port so the
 * demo database is never touched.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const TEST_DB = path.join(os.tmpdir(), `smartpark-test-${Date.now()}.json`);
process.env.JSON_STORE_FILE = TEST_DB;
process.env.SEED_ON_START = 'true';
process.env.RESET_ON_START = 'true';
process.env.NODE_ENV = 'test';

const layout = require('../data/layout');
const pathfinding = require('../services/pathfinding');
const navigation = require('../services/navigationService');
const { parse } = require('../../ai/ocr/plateParser');
const simulatedOcr = require('../../ai/ocr/simulatedOcr');
const { detectVehicle } = require('../../ai/numberPlateDetection/vehicleDetector');
const { locatePlate } = require('../../ai/numberPlateDetection/plateLocator');
const { buildSeed, buildSlots } = require('../database/seedData');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`  PASS  ${name}`);
    })
    .catch((error) => {
      failed += 1;
      failures.push({ name, error });
      console.log(`  FAIL  ${name}\n        ${error.message}`);
    });
}

function group(title) {
  console.log(`\n${title}`);
}

async function main() {
  // ============================================================== unit tests
  group('Layout & map data');

  await test('4 blocks and 48 slots are generated from the layout definition', () => {
    assert.strictEqual(layout.BLOCKS.length, 4);
    assert.strictEqual(layout.totalSlots, 48);
    assert.deepStrictEqual(
      layout.BLOCKS.map((b) => b.name),
      ['Block A', 'Block B', 'Block C', 'Block D'],
    );
  });

  await test('slot ids follow the A-01..A-12 pattern per block', () => {
    const ids = layout.SLOTS.map((s) => s.id);
    assert.ok(ids.includes('A-01') && ids.includes('A-12'));
    assert.strictEqual(new Set(ids).size, 48);
    layout.BLOCKS.forEach((block) => {
      assert.strictEqual(block.slots.length, 12, `${block.name} should have 12 slots`);
    });
  });

  await test('every slot has coordinates and a lane connection node', () => {
    layout.SLOTS.forEach((slot) => {
      assert.ok(Number.isFinite(slot.cx) && Number.isFinite(slot.cy), `${slot.id} coordinates`);
      assert.ok(layout.GRAPH.nodes[slot.nodeId], `${slot.id} node missing`);
      assert.ok(layout.GRAPH.nodes[slot.laneNodeId], `${slot.id} lane node missing`);
    });
  });

  group('Path finding (A* / Dijkstra)');

  await test('the road graph is fully connected from the watchman room', () => {
    const { distances } = pathfinding.dijkstra(layout.GRAPH, layout.NODES.watchman);
    assert.strictEqual(Object.keys(distances).length, Object.keys(layout.GRAPH.nodes).length);
    layout.SLOTS.forEach((slot) => assert.ok(distances[slot.nodeId] !== undefined, `${slot.id} unreachable`));
  });

  await test('A* returns the same optimal cost as Dijkstra for every slot', () => {
    const { distances } = pathfinding.dijkstra(layout.GRAPH, layout.NODES.watchman);
    layout.SLOTS.forEach((slot) => {
      const astarResult = pathfinding.astar(layout.GRAPH, layout.NODES.watchman, slot.nodeId);
      assert.ok(astarResult.found, `${slot.id}: A* found no path`);
      assert.ok(
        Math.abs(astarResult.cost - distances[slot.nodeId]) < 1e-9,
        `${slot.id}: A* ${astarResult.cost} != Dijkstra ${distances[slot.nodeId]}`,
      );
    });
  });

  await test('A* expands fewer nodes than Dijkstra (heuristic works)', () => {
    const astarResult = pathfinding.astar(layout.GRAPH, layout.NODES.watchman, 'SLOT-B-07');
    const dijkstraResult = pathfinding.dijkstra(layout.GRAPH, layout.NODES.watchman);
    assert.ok(astarResult.visited < Object.keys(dijkstraResult.distances).length);
  });

  group('Navigation service');

  await test('route to A-12 has a distance, duration, polyline and steps', () => {
    const route = navigation.getRouteToSlot({ slotId: 'A-12' });
    assert.strictEqual(route.slotId, 'A-12');
    assert.strictEqual(route.blockName, 'Block A');
    assert.ok(route.distanceM > 40, 'distance should be realistic');
    assert.ok(route.durationSec > 0);
    assert.match(route.polyline, /^M \d/);
    assert.ok(route.steps.steps.length >= 3, 'needs turn by turn steps');
    assert.ok(route.steps.steps.some((s) => s.isDestination), 'needs a destination step');
    assert.strictEqual(route.path[0], layout.NODES.watchman);
    assert.strictEqual(route.path[route.path.length - 1], 'SLOT-A-12');
  });

  await test('every slot in every block is navigable', () => {
    layout.SLOTS.forEach((slot) => {
      const route = navigation.getRouteToSlot({ slotId: slot.id });
      assert.ok(route.distanceM > 0 && route.steps.steps.length > 1, `${slot.id} route incomplete`);
    });
  });

  await test('unknown slot returns a 404 style error', () => {
    assert.throws(() => navigation.getRouteToSlot({ slotId: 'Z-99' }), /Unknown parking slot/);
  });

  group('OCR / ANPR');

  await test('valid Indian plates are accepted, invalid ones rejected', () => {
    assert.strictEqual(parse('KA01AB1234').valid, true);
    assert.strictEqual(parse('MH12CD9087').valid, true);
    assert.strictEqual(parse('1234').valid, false);
    assert.strictEqual(parse('XX99ZZ0000').valid, false, 'unknown state code must be rejected');
  });

  await test('OCR confusion repair fixes 0/O and 1/I mistakes', () => {
    const repaired = parse('KAO1AB1234');
    assert.strictEqual(repaired.vehicleNumber, 'KA01AB1234');
    assert.strictEqual(repaired.valid, true);
  });

  await test('vehicle detection + plate localisation return a usable ROI', () => {
    const detection = detectVehicle({ frameId: 'TEST-1' });
    assert.ok(detection.detected);
    assert.ok(detection.vehicle.boundingBox.width > 0);
    const plate = locatePlate(detection);
    assert.ok(plate.found);
    assert.ok(plate.roi.width > 0 && plate.roi.height > 0);
  });

  await test('simulated OCR output always parses to a valid plate', () => {
    for (let i = 0; i < 25; i += 1) {
      const result = simulatedOcr.recognise({ frameId: `SEED-${i}` });
      assert.strictEqual(result.parsed.valid, true, `frame SEED-${i} produced ${result.text}`);
    }
  });

  group('Seed data');

  await test('demo data has 31 parked vehicles and 42 records for today', () => {
    const { vehicles } = buildSeed({ now: new Date() });
    const parked = vehicles.filter((v) => v.status === 'Parked');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const today = vehicles.filter((v) => new Date(v.entryTime) >= todayStart);
    assert.strictEqual(parked.length, 31, 'expected 31 occupied slots');
    assert.strictEqual(today.length, 42, 'expected 42 vehicles for today');
    assert.strictEqual(new Set(vehicles.map((v) => v.vehicleNumber)).size, vehicles.length, 'plates must be unique');
  });

  await test('seeded slots are consistent with parked vehicles', () => {
    const { vehicles } = buildSeed({ now: new Date() });
    const slots = buildSlots(vehicles);
    assert.strictEqual(slots.length, 48);
    const occupiedSlots = slots.filter((s) => s.status === 'Occupied');
    assert.strictEqual(occupiedSlots.length, 31);
    occupiedSlots.forEach((slot) => {
      assert.ok(slot.vehicleNumber, `${slot.slotId} occupied without a plate`);
    });
  });

  // ================================================================ API tests
  group('API flows (login -> entry -> search -> navigate -> exit)');

  const { connect } = require('../database');
  const { app } = require('../server');
  const store = await connect();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let token = null;

  const api = async (pathname, options = {}) => {
    const response = await fetch(`${base}${pathname}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const json = await response.json();
    return { status: response.status, body: json };
  };

  try {
    // 1 ---------------------------------------------------------------- login
    await test('flow 1: login with valid credentials returns a token', async () => {
      const res = await api('/auth/login', { method: 'POST', body: { username: 'watchman', password: 'watch123' } });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.token);
      assert.strictEqual(res.body.user.username, 'watchman');
      token = res.body.token;
    });

    await test('flow 1b: login with a wrong password is rejected', async () => {
      const res = await api('/auth/login', { method: 'POST', body: { username: 'watchman', password: 'nope' } });
      assert.strictEqual(res.status, 401);
    });

    await test('protected routes reject requests without a token', async () => {
      const saved = token;
      token = null;
      const res = await api('/dashboard/stats');
      token = saved;
      assert.strictEqual(res.status, 401);
    });

    // 2 ------------------------------------------------------------ dashboard
    let stats;
    await test('flow 2: dashboard returns totals, occupancy and recent activity', async () => {
      const res = await api('/dashboard/stats');
      assert.strictEqual(res.status, 200);
      stats = res.body.stats;
      assert.strictEqual(stats.totalSlots, 48);
      assert.strictEqual(stats.occupiedSlots + stats.availableSlots, 48);
      assert.ok(stats.vehiclesToday > 0);
      assert.strictEqual(stats.byBlock.length, 4);
      assert.ok(Array.isArray(stats.recentEntries));
      const blockTotal = stats.byBlock.reduce((sum, b) => sum + b.total, 0);
      assert.strictEqual(blockTotal, 48);
    });

    // 8 --------------------------------------------------------- map display
    await test('flow 8: map endpoint returns blocks, slots, roads and the graph', async () => {
      const res = await api('/parking/map');
      assert.strictEqual(res.status, 200);
      const { map } = res.body;
      assert.strictEqual(map.blocks.length, 4);
      assert.strictEqual(map.slots.length, 48);
      assert.ok(map.roads.length >= 5);
      assert.ok(map.landmarks.watchmanRoom);
      assert.ok(Object.keys(map.graph.nodes).length > 100);
      map.slots.forEach((slot) => {
        assert.ok(['Occupied', 'Empty'].includes(slot.status));
        assert.ok(slot.distanceFromWatchmanM > 0, `${slot.id} has no distance`);
      });
    });

    // 3,4,5,6 ------------------------------------------- entry + slot + OCR
    await test('flows 3-6: simulate entry runs OCR, assigns a slot and updates the counts', async () => {
      const before = await api('/dashboard/stats');
      const res = await api('/camera/simulate-entry', {
        method: 'POST',
        body: { vehicleType: 'Car', plateHint: 'KA05MN4321' },
      });
      assert.strictEqual(res.status, 201);
      const { report } = res.body;
      assert.strictEqual(report.success, true);
      assert.strictEqual(report.vehicleNumber, 'KA05MN4321');

      const stages = report.stages.map((s) => s.stage);
      assert.deepStrictEqual(stages, [
        'camera',
        'vehicle-detection',
        'plate-localisation',
        'ocr',
        'plate-validation',
        'duplicate-check',
        'slot-allocation',
        'database',
      ]);
      assert.ok(report.detection.confidence > 0);
      assert.ok(report.ocr.confidence > 0);
      assert.ok(report.slot, 'a slot must be allocated');
      assert.ok(report.block.startsWith('Block'));

      const after = await api('/dashboard/stats');
      assert.strictEqual(after.body.stats.occupiedSlots, before.body.stats.occupiedSlots + 1);
      assert.strictEqual(after.body.stats.availableSlots, before.body.stats.availableSlots - 1);

      const slot = await api(`/parking/slots/${report.slot}`);
      assert.strictEqual(slot.body.slot.status, 'Occupied');
      assert.strictEqual(slot.body.slot.vehicleNumber, 'KA05MN4321');
    });

    await test('flow 5: the allocated slot is the best free slot by distance + type penalty', async () => {
      const res = await api('/parking/next-available');
      const slot = res.body.slot;
      const scoreOf = (s) => s.distanceFromGateM + (s.typePenaltyM || 0);
      const chosen = scoreOf(slot);
      const slots = await api('/parking/slots?status=Empty');
      // the chosen bay is already reserved, so it is no longer in the empty list
      const best = Math.min(chosen, ...slots.body.slots.map(scoreOf));
      assert.strictEqual(chosen, best, `allocator must pick the best free bay (chose ${slot.slotId} ${chosen}, best ${best})`);
      assert.ok(
        slot.alternatives.every((a) => a.score >= slot.score),
        'alternatives must never be better than the chosen slot',
      );
      assert.ok(chosen < 200, 'the chosen bay must be a realistic walk from the gate');
    });

    await test('a duplicate entry for a parked plate is rejected and reserves nothing', async () => {
      const before = await api('/parking/slots?status=Empty');
      const res = await api('/camera/simulate-entry', { method: 'POST', body: { plateHint: 'KA05MN4321' } });
      assert.strictEqual(res.body.success, false, 'the second entry must not succeed');
      assert.strictEqual(res.body.report.reason, 'ALREADY_PARKED');
      assert.match(res.body.report.message, /already parked at/);
      assert.ok(
        res.body.report.stages.some((s) => s.stage === 'duplicate-check' && !s.ok),
        'the pipeline must log a failed duplicate check',
      );
      const after = await api('/parking/slots?status=Empty');
      assert.strictEqual(after.body.slots.length, before.body.slots.length, 'a rejected entry must not consume a bay');
    });

    // 7 ------------------------------------------------------ vehicle search
    await test('flow 7: search finds a parked vehicle by number', async () => {
      const res = await api('/vehicles/search?q=KA05MN4321');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.parked.length, 1);
      assert.strictEqual(res.body.parked[0].vehicleNumber, 'KA05MN4321');
    });

    await test('flow 7b: search works with a partial number (case insensitive)', async () => {
      const res = await api('/vehicles/search?q=ka05mn');
      assert.ok(res.body.parked.length >= 1);
    });

    await test('flow 7c: search finds a slot by slot id', async () => {
      const res = await api('/vehicles/search?q=A-12');
      assert.ok(res.body.slots.length >= 1);
    });

    await test('flow 7d: vehicle detail includes owner, block, slot and entry time', async () => {
      const res = await api('/vehicles/KA05MN4321');
      assert.strictEqual(res.status, 200);
      const v = res.body.vehicle;
      assert.strictEqual(v.vehicleNumber, 'KA05MN4321');
      assert.ok(v.ownerName);
      assert.ok(v.blockName);
      assert.ok(v.slotId);
      assert.ok(v.entryTime);
      assert.strictEqual(v.status, 'Parked');
      assert.ok(v.slotPosition.row >= 1);
    });

    await test('flow 7e: an unknown plate returns 404', async () => {
      const res = await api('/vehicles/ZZ99ZZ9999');
      assert.strictEqual(res.status, 404);
    });

    // 9,10 ------------------------------------------------------- navigation
    let route;
    await test('flows 9-10: navigation route from the watchman room to a slot', async () => {
      const res = await api('/navigation/route?slot=A-12');
      assert.strictEqual(res.status, 200);
      route = res.body.route;
      assert.strictEqual(route.slotId, 'A-12');
      assert.match(route.algorithm, /A\*/);
      assert.ok(route.distanceM > 0);
      assert.ok(route.durationLabel.length > 0);
      assert.ok(route.points.length > 3);
      assert.ok(route.steps.steps.length >= 4);
      assert.strictEqual(route.steps.steps[0].kind, 'exit');
      assert.strictEqual(route.steps.steps[route.steps.steps.length - 1].isDestination, true);
    });

    await test('flow 9b: Dijkstra can be used explicitly and agrees with A*', async () => {
      const res = await api('/navigation/route?slot=A-12&algorithm=dijkstra');
      assert.match(res.body.route.algorithm, /Dijkstra/);
      assert.ok(Math.abs(res.body.route.distanceM - route.distanceM) < 0.01);
    });

    await test('flow 9c: routing to an unknown slot returns 404', async () => {
      const res = await api('/navigation/route?slot=A-99');
      assert.strictEqual(res.status, 404);
    });

    await test('flow 9d: distances endpoint covers all 48 slots', async () => {
      const res = await api('/navigation/distances');
      assert.strictEqual(Object.keys(res.body.distances).length, 48);
      assert.ok(res.body.distances['A-12'] > 0);
    });

    // 11,12 ----------------------------------------------------- exit / release
    await test('flows 11-12: exit releases the slot and counts update', async () => {
      const before = await api('/dashboard/stats');
      const entry = await api('/vehicles/search?q=KA05MN4321');
      const slotId = entry.body.parked[0].slotId;

      const res = await api('/camera/simulate-exit', { method: 'POST', body: { plateHint: 'KA05MN4321' } });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.report.message.includes('slot released'));

      const after = await api('/dashboard/stats');
      assert.strictEqual(after.body.stats.occupiedSlots, before.body.stats.occupiedSlots - 1);
      assert.strictEqual(after.body.stats.availableSlots, before.body.stats.availableSlots + 1);

      const slot = await api(`/parking/slots/${slotId}`);
      assert.strictEqual(slot.body.slot.status, 'Empty');
      assert.strictEqual(slot.body.slot.vehicleNumber, null);

      const vehicle = await api('/vehicles/KA05MN4321');
      assert.strictEqual(vehicle.body.vehicle.status, 'Exited');
      assert.ok(vehicle.body.vehicle.exitTime);
    });

    await test('flow 11b: exiting the same vehicle twice returns 404', async () => {
      const res = await api('/camera/simulate-exit', { method: 'POST', body: { plateHint: 'KA05MN4321' } });
      assert.strictEqual(res.status, 404);
    });

    await test('flow 11c: a vehicle can exit by slot id', async () => {
      const res = await api('/vehicles/search?q=KA');
      const parked = res.body.parked[0];
      const exit = await api('/vehicles/exit', { method: 'POST', body: { slotId: parked.slotId } });
      assert.strictEqual(exit.status, 200);
      assert.strictEqual(exit.body.vehicle.slotId, parked.slotId);
    });

    // 13 -------------------------------------------------------------- history
    await test('vehicle history supports today / week / month filters', async () => {
      const today = await api('/vehicles/history?range=today');
      const week = await api('/vehicles/history?range=week');
      const month = await api('/vehicles/history?range=month');
      assert.ok(today.body.total > 0);
      assert.ok(week.body.total >= today.body.total);
      assert.ok(month.body.total >= week.body.total);
      const filtered = await api('/vehicles/history?range=month&status=Parked');
      assert.ok(filtered.body.vehicles.every((v) => v.status === 'Parked'));
    });

    // OCR upload path
    await test('OCR endpoint parses an uploaded plate image', async () => {
      const res = await api('/camera/ocr', { method: 'POST', body: { plateHint: 'KA01AB1234' } });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ocr.parsed.vehicleNumber, 'KA01AB1234');
      assert.ok(res.body.ocr.engine);
      assert.match(res.body.plateImage, /^<svg/);
    });

    await test('full parking (48/48) blocks new entries', async () => {
      const slots = await store.listSlots();
      for (const slot of slots) {
        if (slot.status === 'Empty') {
          await store.updateSlot(slot.slotId, { status: 'Occupied', vehicleNumber: 'XX00XX0000' });
        }
      }
      const res = await api('/camera/simulate-entry', { method: 'POST', body: {} });
      assert.ok(!res.body.report.success);
      assert.strictEqual(res.body.report.reason, 'PARKING_FULL');
      for (const slot of slots) {
        if (slot.vehicleNumber === 'XX00XX0000') {
          await store.updateSlot(slot.slotId, { status: 'Empty', vehicleNumber: null, vehicleId: null, entryTime: null });
        }
      }
    });

    await test('the 48 slot grid can be completely filled and released', async () => {
      const before = (await api('/dashboard/stats')).body.stats;
      const slots = await store.listSlots();
      const empty = slots.filter((s) => s.status === 'Empty');
      for (const slot of empty) {
        await store.updateSlot(slot.slotId, { status: 'Occupied', vehicleNumber: `KA01ZZ${slot.slotId.slice(2)}` });
      }
      const full = (await api('/dashboard/stats')).body.stats;
      assert.strictEqual(full.availableSlots, 0);
      assert.strictEqual(full.occupiedSlots, 48);
      for (const slot of empty) {
        await store.updateSlot(slot.slotId, { status: 'Empty', vehicleNumber: null, vehicleId: null, entryTime: null });
      }
      const restored = (await api('/dashboard/stats')).body.stats;
      assert.strictEqual(restored.occupiedSlots, before.occupiedSlots);
    });
  } finally {
    server.close();
  }

  console.log(`\n${'-'.repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${'-'.repeat(60)}\n`);

  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nTest runner crashed:', error);
  process.exit(1);
});
