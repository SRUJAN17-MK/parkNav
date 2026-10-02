'use strict';

/**
 * SmartPark - OCR facade used by the backend.
 *
 * Strategy (config.camera.ocrEngine):
 *   'auto'      -> tesseract.js when installed, otherwise the simulator
 *   'sim'       -> always the built-in simulator (default for the demo)
 *   'tesseract' -> require tesseract.js, fail loudly if it is missing
 *
 * Both engines return the SAME shape, so the rest of the pipeline is identical.
 */

const simulatedOcr = require('./simulatedOcr');
const tesseractAdapter = require('./tesseractAdapter');
const { parse, repair, normalise, isValidNumber } = require('./plateParser');

const config = require('../../backend/config');

function engineStatus() {
  return {
    configured: config.camera.ocrEngine,
    tesseractInstalled: tesseractAdapter.isAvailable(),
    active: resolveEngine(),
  };
}

function resolveEngine() {
  const configured = config.camera.ocrEngine;
  if (configured === 'sim') return 'built-in-simulator';
  if (configured === 'tesseract') return tesseractAdapter.isAvailable() ? 'tesseract.js' : 'unavailable';
  return tesseractAdapter.isAvailable() ? 'tesseract.js' : 'built-in-simulator';
}

/**
 * Reads the number plate.
 *
 * @param {object} options
 * @param {string} [options.frameId]
 * @param {string} [options.plateHint]  use this plate instead of generating one
 * @param {object} [options.detection]  vehicle detection result (for the ROI)
 * @param {object} [options.plateRegion] plate ROI from plateLocator
 * @param {string|Buffer} [options.image] uploaded image (base64 or buffer)
 * @returns {Promise<object>} OCR result
 */
async function readNumberPlate(options = {}) {
  const engine = resolveEngine();

  if (engine === 'unavailable') {
    const error = new Error('OCR_ENGINE=tesseract was requested but tesseract.js is not installed. Run: cd ai/ocr && npm install');
    error.status = 503;
    throw error;
  }

  if (engine === 'tesseract.js' && (options.image || options.buffer)) {
    try {
      const raw = await tesseractAdapter.recognise(options.buffer || options.image);
      const parsed = parse(raw.text);
      return {
        text: raw.text,
        repaired: repair(raw.text),
        parsed,
        confidence: raw.confidence,
        engine: raw.engine,
        characters: [],
        processingMs: raw.processingMs,
        degraded: raw.text !== repair(raw.text),
      };
    } catch (error) {
      console.warn(`[ocr] tesseract failed (${error.message}) - using the built-in simulator`);
    }
  }

  return simulatedOcr.recognise(options);
}

module.exports = { readNumberPlate, engineStatus, resolveEngine, parse, repair, normalise, isValidNumber, renderPlateSvg: simulatedOcr.renderPlateSvg, simulatedOcr, tesseractAdapter };
