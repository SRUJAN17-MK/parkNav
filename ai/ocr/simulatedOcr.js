'use strict';

/**
 * SmartPark - Simulated OCR engine.
 *
 * Used for the college demo when tesseract.js (or a camera) is not available.
 * It is NOT a lookup table: it derives a plate from a hash of the camera frame,
 * then degrades it the way a real OCR engine does (blurred characters, a
 * misread 0/O, a low-contrast patch) before the parser repairs and validates
 * it. That keeps the full pipeline honest:
 *
 *   detect -> locate -> OCR (noisy) -> repair/validate -> slot allocation
 */

const { parse, repair } = require('./plateParser');

const STATES = ['KA', 'MH', 'TN', 'AP', 'TS', 'KL', 'GJ', 'DL', 'RJ', 'MH', 'KA', 'KA'];
const RTOS = ['01', '02', '03', '04', '05', '09', '10', '20', '25', '53'];
// Indian plate series use letters only (vowels other than A are not issued).
const LETTERS = 'ABCDFGHJKLMNPQRSTVWXYZ';

function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 2166136261;
  const str = String(value);
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Builds a plausible plate for a frame. */
function generatePlate(seed) {
  const random = createRandom(seed);
  const state = STATES[Math.floor(random() * STATES.length)];
  const rto = RTOS[Math.floor(random() * RTOS.length)];
  const l1 = LETTERS[Math.floor(random() * LETTERS.length)];
  const l2 = LETTERS[Math.floor(random() * LETTERS.length)];
  const serial = String(1000 + Math.floor(random() * 8999));
  return `${state}${rto}${l1}${l2}${serial}`;
}

/** Digits an OCR engine commonly reports as a look-alike letter. */
const DIGIT_CONFUSION = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 8: 'B' };

/**
 * Simulates the character level errors a real OCR engine makes.
 * @returns {{text:string, confidence:number, characters:object[], degraded:boolean}}
 */
function degrade(plate, seed) {
  const random = createRandom(seed ^ 0x9e3779b9);
  const characters = plate.split('').map((ch, index) => ({
    index,
    char: ch,
    raw: ch,
    confidence: Math.round((0.9 + random() * 0.099) * 1000) / 1000,
    corrected: false,
  }));

  // ~35% of frames contain at least one 0/O, 1/I, 5/S or 8/B confusion - the most
  // common real world OCR mistake. Only *numeric* positions are corrupted: a digit
  // read as a letter is recoverable because the plate format demands a digit
  // there, whereas a letter read as a digit loses information and the engine must
  // report an unreadable plate rather than invent a different valid one.
  if (random() < 0.35) {
    const idx = characters.findIndex((c) => c.index > 1 && DIGIT_CONFUSION[c.char] !== undefined);
    if (idx > 0) {
      characters[idx].raw = characters[idx].char;
      characters[idx].char = DIGIT_CONFUSION[characters[idx].char];
      characters[idx].corrected = true;
      characters[idx].confidence = Math.round((0.55 + random() * 0.2) * 1000) / 1000;
    }
  }

  const text = characters.map((c) => c.char).join('');
  const confidence =
    Math.round((characters.reduce((sum, c) => sum + c.confidence, 0) / characters.length) * 1000) / 10;
  return { text, confidence, characters, degraded: text !== repair(plate) };
}

/**
 * Main entry point used by the backend.
 *
 * @param {object}  options
 * @param {string}  options.frameId   camera frame reference (drives the result)
 * @param {string} [options.plateHint] force a specific plate (manual entry)
 * @param {number} [options.seed]
 * @returns {{text:string, repaired:string, parsed:object, confidence:number,
 *            engine:string, characters:object[], processingMs:number}}
 */
function recognise(options = {}) {
  const started = Date.now();
  const seed = options.seed ?? hashString(options.frameId || `frame-${Date.now()}`);
  const truth = options.plateHint ? String(options.plateHint).toUpperCase().replace(/[^A-Z0-9]/g, '') : generatePlate(seed);
  const { text, confidence, characters, degraded } = degrade(truth, seed);
  const parsed = parse(text);

  return {
    text,
    repaired: repair(text),
    truth,
    parsed,
    confidence,
    degraded,
    engine: 'built-in-simulator',
    characters,
    processingMs: Date.now() - started + 180 + (seed % 140),
  };
}

/** Renders the detected plate as an inline SVG (used in the demo UI). */
function renderPlateSvg(plateText, options = {}) {
  const text = String(plateText || '').toUpperCase();
  const width = 340;
  const height = 92;
  const charWidth = width / (text.length + 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.width || width}" height="${
    options.height || height
  }" viewBox="0 0 ${width} ${height}" role="img" aria-label="Number plate ${text}">
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="10" fill="#f8fafc" stroke="#0f172a" stroke-width="4"/>
  <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="6" fill="none" stroke="#1d4ed8" stroke-width="2" stroke-dasharray="6 5"/>
  <text x="${width / 2}" y="${height / 2 + 12}" text-anchor="middle" font-family="'Courier New',monospace" font-size="44" font-weight="700" fill="#0f172a" letter-spacing="2">${text}</text>
</svg>`;
}

module.exports = { recognise, generatePlate, degrade, renderPlateSvg, DIGIT_CONFUSION };
