'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Audit trail of everything the entrance camera pipeline did.
 * Powers the live "Camera / ANPR" console in the UI.
 */
const cameraEventSchema = new Schema(
  {
    type: { type: String, enum: ['Entry', 'Exit', 'OCR', 'Rejected', 'Manual'], required: true, index: true },
    cameraId: { type: String, default: '' },
    vehicleNumber: { type: String, default: null, index: true },
    slotId: { type: String, default: null },
    blockName: { type: String, default: null },
    confidence: { type: Number, default: null },
    engine: { type: String, default: 'simulator' },
    message: { type: String, default: '' },
    pipeline: [{ stage: String, detail: String, ok: Boolean, ms: Number }],
    plateImage: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

cameraEventSchema.index({ createdAt: -1 });

const toPlain = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return { ...obj, id: String(obj._id || obj.id) };
};

module.exports = mongoose.models.CameraEvent || mongoose.model('CameraEvent', cameraEventSchema);
module.exports.toPlain = toPlain;
