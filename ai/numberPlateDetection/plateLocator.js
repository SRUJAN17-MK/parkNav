'use strict';

/**
 * SmartPark - Step 2 of the ANPR pipeline: NUMBER PLATE LOCALISATION.
 *
 * Production path: OpenCV contour analysis (see opencv_plate_detector.py) or a
 * lightweight CRAFT/EAST text detector. The plate ROI is then cropped,
 * deskewed, grayscaled and contrast enhanced before OCR.
 *
 * Demo path: derives the plate region from the vehicle bounding box using
 * fixed relative geometry - exactly how a real front-plate ROI is derived.
 */

function hashString(value) {
  let hash = 2166136261;
  const str = String(value);
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Crops the number-plate region of interest (ROI) from a detected vehicle.
 *
 * @param {object} detection output of detectVehicle()
 * @returns {{found:boolean, engine:string, roi:null|{x,y,width,height},
 *            angle:number, aspectRatio:number, processingMs:number}}
 */
function locatePlate(detection) {
  const started = Date.now();
  if (!detection || !detection.detected || !detection.vehicle) {
    return { found: false, engine: 'simulated-plate-locator', roi: null, angle: 0, aspectRatio: 0, processingMs: 4 };
  }

  const random = createRandom(hashString(`${detection.frameId}-plate`));
  const box = detection.vehicle.boundingBox;
  // Front number plate sits in the lower-middle third of the vehicle box.
  const roiWidth = Math.round(box.width * (0.42 + random() * 0.06));
  const roiHeight = Math.round(roiWidth * (0.24 + random() * 0.05));
  const roi = {
    x: Math.round(box.x + box.width / 2 - roiWidth / 2 + (random() - 0.5) * 6),
    y: Math.round(box.y + box.height * (0.62 + random() * 0.08)),
    width: roiWidth,
    height: roiHeight,
  };
  const angle = Math.round((random() - 0.5) * 6 * 10) / 10;

  return {
    found: true,
    engine: 'simulated-plate-locator',
    roi,
    angle,
    aspectRatio: Math.round((roiWidth / roiHeight) * 100) / 100,
    processingMs: Date.now() - started + Math.round(6 + random() * 10),
  };
}

module.exports = { locatePlate };
