'use strict';

/**
 * SmartPark - OCR step 3: Tesseract adapter.
 *
 * This is the REAL OCR path. It is only used when `tesseract.js` is installed:
 *
 *   cd ai/ocr && npm install
 *
 * tesseract.js is an optional dependency on purpose: it downloads language
 * data (~15 MB) on first use, which must not be required for a classroom demo.
 * The backend falls back to the built-in simulator (simulatedOcr.js) whenever
 * tesseract.js is unavailable - see ocrEngine.js.
 */

const WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';

let workerPromise = null;
let available = null;

/** Is tesseract.js installed? (checked once, cached) */
function isAvailable() {
  if (available !== null) return available;
  try {
    require.resolve('tesseract.js');
    available = true;
  } catch {
    available = false;
  }
  return available;
}

async function getWorker(langPath = 'eng') {
  if (!isAvailable()) throw new Error('tesseract.js is not installed');
  if (!workerPromise) {
    // eslint-disable-next-line global-require
    const { createWorker } = require('tesseract.js');
    workerPromise = createWorker(langPath, 1, {
      cachePath: undefined,
      logger: () => {},
    });
  }
  return workerPromise;
}

/**
 * Runs Tesseract on an image buffer / base64 string.
 *
 * @param {Buffer|string} image  PNG/JPEG buffer or base64 data string
 * @param {object} [options]
 * @returns {Promise<{text:string, confidence:number, engine:string, symbols:object, processingMs:number}>}
 */
async function recognise(image, options = {}) {
  const started = Date.now();
  const worker = await getWorker(options.lang || 'eng');
  const input = Buffer.isBuffer(image) ? image : image;
  const { data } = await worker.recognize(input, options.rectangle || {}, {
    tessedit_char_whitelist: WHITELIST,
    tessedit_pageseg_mode: '7', // single text line - plates are one line
  });
  return {
    text: (data.text || '').replace(/[^A-Z0-9-]/gi, '').toUpperCase(),
    confidence: Math.round((data.confidence || 0) * 10) / 10,
    engine: 'tesseract.js',
    symbols: data.symbols || [],
    processingMs: Date.now() - started,
  };
}

async function terminate() {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } finally {
    workerPromise = null;
  }
}

module.exports = { isAvailable, recognise, terminate, WHITELIST };
