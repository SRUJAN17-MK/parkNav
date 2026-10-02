'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 5000),
  host: process.env.HOST || '0.0.0.0',

  jwt: {
    secret: process.env.JWT_SECRET || 'smartpark-dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },

  // Leave MONGODB_URI empty to run on the built-in JSON store (no install needed).
  mongoUri: process.env.MONGODB_URI || '',
  mongoTimeoutMs: toInt(process.env.MONGO_TIMEOUT_MS, 4000),
  dbName: process.env.MONGO_DB_NAME || 'smart_parking',

  jsonStoreFile: process.env.JSON_STORE_FILE || path.join(__dirname, '..', 'data', 'db.json'),

  seedOnStart: String(process.env.SEED_ON_START || 'true') !== 'false',
  resetOnStart: String(process.env.RESET_ON_START || 'false') === 'true',

  camera: {
    id: process.env.CAMERA_ID || 'CAM-GATE-01',
    location: process.env.CAMERA_LOCATION || 'Main Gate - Entry Lane',
    // 'auto'  -> use tesseract.js when it is installed, otherwise the built-in simulator
    // 'sim'   -> always use the built-in simulator
    // 'tesseract' -> fail loudly if tesseract.js is missing
    ocrEngine: process.env.OCR_ENGINE || 'auto',
  },

  navigation: {
    walkingSpeedMps: Number.parseFloat(process.env.WALKING_SPEED_MPS || '1.25'),
  },

  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5175,http://127.0.0.1:5175,http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

module.exports = config;
