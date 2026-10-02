'use strict';

/**
 * Database bootstrap.
 *
 * Priority:
 *   1. MONGODB_URI set  -> MongoDB via Mongoose (production / college lab server)
 *   2. MONGODB_URI set but unreachable -> warn and fall back to the JSON store
 *   3. MONGODB_URI empty -> built-in JSON store (zero-install demo mode)
 */

const config = require('../config');
const { buildSeed, buildSlots } = require('./seedData');

let store = null;

async function tryMongo() {
  if (!config.mongoUri) return null;
  // Loaded lazily so mongoose is only required when it is actually needed.
  const MongoStore = require('./mongoStore');
  const candidate = new MongoStore(config.mongoUri, config);
  try {
    await candidate.connect();
    console.log(`[db] MongoDB connected -> ${candidate.connection.name}`);
    return candidate;
  } catch (error) {
    console.warn(`[db] MongoDB connection failed (${error.message}).`);
    console.warn('[db] Falling back to the built-in JSON store so the demo still runs.');
    try {
      await candidate.disconnect();
    } catch {
      /* ignore */
    }
    return null;
  }
}

async function connect() {
  if (store) return store;
  const mongo = await tryMongo();
  if (mongo) {
    store = mongo;
  } else {
    const JsonStore = require('./jsonStore');
    store = await new JsonStore(config.jsonStoreFile).connect();
    console.log(`[db] JSON store ready -> ${config.jsonStoreFile}`);
  }
  if (config.resetOnStart) {
    console.log('[db] RESET_ON_START=true - clearing all collections');
    await store.reset();
  }
  if (config.seedOnStart && (await store.isEmpty())) {
    console.log('[db] Empty database detected - loading demo data');
    await seed(store);
  }
  return store;
}

async function seed(target = store) {
  const { users, vehicles } = buildSeed({ now: new Date() });
  if (typeof target.beginBatch === 'function') await target.beginBatch();
  await target.reset();
  for (const user of users) {
    await target.createUser(user);
  }
  await target.insertSlots(buildSlots(vehicles));
  for (const vehicle of vehicles) {
    await target.createVehicle(vehicle);
  }
  if (typeof target.endBatch === 'function') await target.endBatch();
  const parked = vehicles.filter((v) => v.status === 'Parked').length;
  console.log(
    `[db] Seeded ${users.length} users, ${vehicles.length} vehicle records (${parked} parked) across ${require('../data/layout').totalSlots} slots`,
  );
  return { users: users.length, vehicles: vehicles.length, parked };
}

function getStore() {
  if (!store) throw new Error('Database not initialised - call connect() first');
  return store;
}

module.exports = { connect, seed, getStore, config };
