'use strict';

/**
 * SmartPark - end-to-end smoke test.
 *
 *   node scripts/health.js
 *
 * Verifies that the API is up, the demo database is seeded and the whole
 * watchman workflow (login -> entry -> search -> navigate -> exit) still works.
 */

const BASE = process.env.API_BASE || 'http://localhost:5000';

let pass = 0;
let fail = 0;

function check(label, condition, extra = '') {
  if (condition) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${extra ? ` -> ${extra}` : ''}`);
  }
}

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

(async () => {
  console.log(`\nSmartPark smoke test against ${BASE}\n`);

  // 1 - health
  const health = await call('/api/health').catch(() => null);
  if (!health) {
    console.log('  FAIL  API is not reachable. Start it with: npm run dev');
    process.exit(1);
  }
  check('API health endpoint responds', health.status === 200);

  // 2 - login
  const login = await call('/api/auth/login', {
    method: 'POST',
    body: { username: 'watchman', password: 'watch123' },
  });
  check('login with watchman / watch123', login.status === 200 && Boolean(login.body.token), login.body.message);
  const token = login.body.token;

  // 3 - protected route rejects anonymous callers
  const anon = await call('/api/dashboard/stats');
  check('dashboard rejects requests without a token', anon.status === 401);

  // 4 - dashboard stats
  const stats = await call('/api/dashboard/stats', { token });
  const s = stats.body.stats || {};
  check('dashboard returns 48 slots', s.totalSlots === 48, `got ${s.totalSlots}`);
  check('occupied + available = total', s.occupiedSlots + s.availableSlots === s.totalSlots);
  check('dashboard has per-block breakdown', Array.isArray(s.byBlock) && s.byBlock.length === 4);

  // 5 - map
  const map = await call('/api/parking/map', { token });
  const m = map.body.map || {};
  check('map returns every slot', (m.slots || []).length === 48, `got ${(m.slots || []).length}`);
  check('map contains the navigation graph', Boolean(m.graph?.nodes && m.graph?.edges));
  check('map defines the watchman room', Boolean(m.landmarks?.watchmanRoom));

  // 6 - simulated entry (ANPR pipeline)
  const before = s.availableSlots;
  const entry = await call('/api/camera/simulate-entry', { method: 'POST', body: { vehicleType: 'Car' }, token });
  const report = entry.body.report || {};
  check('simulated entry succeeds', entry.status === 201 && report.success === true, report.reason);
  check('pipeline reports all ANPR stages', (report.stages || []).length >= 7, `${(report.stages || []).length} stages`);
  check('entry returns a slot and block', Boolean(report.slot && report.block));

  const after = await call('/api/dashboard/stats', { token });
  check(
    'available slots decreased after entry',
    after.body.stats.availableSlots === before - 1,
    `${before} -> ${after.body.stats.availableSlots}`,
  );

  // 7 - search the vehicle that just arrived
  const plate = report.vehicleNumber;
  const search = await call(`/api/vehicles/search?q=${plate}`, { token });
  check('search finds the new vehicle', (search.body.parked || []).length >= 1, search.body.message);

  const detail = await call(`/api/vehicles/${plate}`, { token });
  check('vehicle detail has owner, block and slot', Boolean(detail.body.vehicle?.ownerName && detail.body.vehicle?.blockName && detail.body.vehicle?.slotId));

  // 8 - route calculation
  const route = await call(`/api/navigation/route?slot=${report.slot}`, { token });
  const r = route.body.route || {};
  check('A* route is returned', route.status === 200 && Boolean(r.polyline), route.body.message);
  check('route starts at the watchman room', r.from?.nodeId === 'WATCHMAN_ROOM');
  check('route has a positive distance', r.distanceM > 0, `${r.distanceM} m`);
  check('route has turn-by-turn steps', (r.steps?.steps || []).length >= 2, `${(r.steps?.steps || []).length} steps`);

  const dijkstra = await call(`/api/navigation/route?slot=${report.slot}&algorithm=dijkstra`, { token });
  check(
    'Dijkstra agrees with A* on distance',
    Math.abs((dijkstra.body.route?.distanceM || 0) - r.distanceM) < 0.5,
    `${dijkstra.body.route?.distanceM} vs ${r.distanceM}`,
  );

  // 9 - exit releases the slot
  const exit = await call('/api/camera/simulate-exit', { method: 'POST', body: { plateHint: plate }, token });
  check('simulated exit succeeds', exit.status === 200 && exit.body.success === true, exit.body.message);

  const finalStats = await call('/api/dashboard/stats', { token });
  check(
    'available slots restored after exit',
    finalStats.body.stats.availableSlots === before,
    `${finalStats.body.stats.availableSlots} vs ${before}`,
  );

  // 10 - history filters
  const today = await call('/api/vehicles/history?range=today', { token });
  check('history supports the today filter', today.status === 200 && Array.isArray(today.body.vehicles));
  const month = await call('/api/vehicles/history?range=month', { token });
  check('history supports the month filter', month.status === 200 && month.body.total >= today.body.total);

  // 11 - slot status consistency
  const slotRes = await call(`/api/parking/slots/${report.slot}`, { token });
  check('released slot is Empty again', slotRes.body.slot?.status === 'Empty', slotRes.body.slot?.status);

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((error) => {
  console.error('\nSmoke test crashed:', error.message);
  process.exit(1);
});
