'use strict';

/**
 * Seed / reset the demo database.
 *
 *   node database/seed.js            -> wipe + reload demo data
 *   node database/seed.js --keep     -> reload demo data without wiping users
 */

const path = require('path');
const readline = require('readline');

const config = require('../config');
const { connect, seed } = require('./index');

async function main() {
  const args = process.argv.slice(2);
  const store = await connect();

  if (args.includes('--status')) {
    const users = await store.listUsers();
    const vehicles = await store.listVehicles();
    const slots = await store.listSlots();
    const occupied = slots.filter((s) => s.status === 'Occupied').length;
    console.log('--- SmartPark database status ---');
    console.log(`driver      : ${store.driver}`);
    console.log(`users       : ${users.length}`);
    console.log(`vehicles    : ${vehicles.length}`);
    console.log(`slots       : ${slots.length} (occupied ${occupied}, empty ${slots.length - occupied})`);
    return;
  }

  if (process.stdin.isTTY && !args.includes('--yes')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) =>
      rl.question(`This will DELETE all data in ${store.driver === 'mongodb' ? config.dbName : config.jsonStoreFile}. Continue? (y/N) `, resolve),
    );
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.log('Aborted.');
      return;
    }
  }

  const result = await seed(store);
  console.log('Seed complete:', result);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exit(1);
  });

module.exports = { main, path };
