'use strict';

/**
 * SmartPark - Step 1 of the ANPR pipeline: VEHICLE DETECTION.
 *
 * Production path (real deployment):
 *   camera frame -> OpenCV / YOLO object detection -> vehicle bounding box
 *
 * Demo path (this project, no GPU required):
 *   a deterministic motion + shape simulation that produces a realistic
 *   detection result: bounding box, confidence, vehicle class, plate region.
 *
 * The exact same interface is used by the backend, so swapping the simulator
 * for a real model only means replacing the body of `detectVehicle()`.
 */

const VEHICLE_CLASSES = ['car', 'suv', 'hatchback', 'bike', 'van'];
const CLASS_WEIGHTS = { car: 0.55, suv: 0.25, hatchback: 0.12, van: 0.05, bike: 0.03 };

/** Camera frame size used by the entrance ANPR camera (1920x1080 typical). */
const FRAME = { width: 1920, height: 1080 };

function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickClass(random) {
  const roll = random();
  let acc = 0;
  for (const [name, weight] of Object.entries(CLASS_WEIGHTS)) {
    acc += weight;
    if (roll <= acc) return name;
  }
  return 'car';
}

/**
 * Detects a vehicle in a camera frame.
 *
 * @param {object}  [options]
 * @param {string}  [options.frameId]      logical camera frame reference
 * @param {number}  [options.seed]         deterministic seed for the simulator
 * @param {boolean} [options.forceDetection] simulate a frame with no vehicle
 * @param {object}  [options.frame]        { width, height } of the frame
 * @returns {{detected:boolean, engine:string, frameId:string, frame:object,
 *            vehicle:null|{class:string, confidence:number, boundingBox:object},
 *            plateRegion:null|object, processingMs:number}}
 */
function detectVehicle(options = {}) {
  const started = Date.now();
  const frame = options.frame || FRAME;
  const frameId = options.frameId || `FRAME-${Date.now()}`;
  const seed = options.seed ?? hashString(frameId);
  const random = createRandom(seed);

  if (options.forceDetection === false) {
    return {
      detected: false,
      engine: 'simulated-motion-detector',
      frameId,
      frame,
      vehicle: null,
      plateRegion: null,
      processingMs: Date.now() - started + 8,
    };
  }

  const vehicleClass = pickClass(random);
  const boxWidth = Math.round(frame.width * (0.26 + random() * 0.16));
  const boxHeight = Math.round(frame.width * (vehicleClass === 'bike' ? 0.16 : 0.34) * (0.85 + random() * 0.3));
  const x = Math.round((frame.width - boxWidth) / 2 + (random() - 0.5) * frame.width * 0.08);
  const y = Math.round(frame.height * 0.28 + random() * frame.height * 0.1);
  const confidence = Math.round((0.9 + random() * 0.095) * 1000) / 1000;

  const boundingBox = {
    x,
    y,
    width: boxWidth,
    height: boxHeight,
    label: vehicleClass,
    score: confidence,
  };

  return {
    detected: true,
    engine: 'simulated-motion-detector',
    frameId,
    frame,
    vehicle: { class: vehicleClass, confidence, boundingBox },
    plateRegion: null, // filled in by the plate locator
    processingMs: Date.now() - started + Math.round(12 + random() * 20),
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

module.exports = { detectVehicle, VEHICLE_CLASSES, FRAME };
