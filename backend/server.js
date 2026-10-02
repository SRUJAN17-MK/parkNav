'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config');
const { connect } = require('./database');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const layout = require('./data/layout');

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '8mb' })); // base64 camera frames / plate images
app.use(express.urlencoded({ extended: true }));
if (config.env !== 'test') app.use(morgan('dev'));

app.get('/', (req, res) =>
  res.json({
    success: true,
    service: 'SmartPark API',
    module: 'Smart Apartment Car Parking Management System',
    database: require('./database').getStore().driver,
    layout: {
      slots: layout.totalSlots,
      blocks: layout.BLOCKS.map((b) => b.name),
      graph: { nodes: Object.keys(layout.GRAPH.nodes).length, edges: layout.GRAPH.edges.length },
    },
    docs: 'See README.md for the endpoint list',
  }),
);

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

async function start() {
  const store = await connect();
  app.locals.store = store;
  app.listen(config.port, config.host, () => {
    console.log('');
    console.log('  SmartPark - Apartment Car Parking Management System');
    console.log(`  API      : http://localhost:${config.port}/api`);
    console.log(`  Database : ${store.driver === 'mongodb' ? `MongoDB (${config.dbName})` : config.jsonStoreFile}`);
    console.log(`  Layout   : ${layout.totalSlots} slots across ${layout.BLOCKS.length} blocks`);
    console.log(`  Login    : watchman / watch123`);
    console.log('');
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('[server] failed to start:', error);
    process.exit(1);
  });
}

module.exports = { app, start };
