'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * One row per parking session (entry -> exit).
 *
 * status: 'Parked'  -> the vehicle is physically inside the campus
 *         'Exited'  -> the vehicle has left, the slot has been released
 */
const vehicleSchema = new Schema(
  {
    vehicleNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    ownerName: { type: String, required: true, trim: true },
    ownerPhone: { type: String, default: '' },
    ownerFlat: { type: String, default: '' },
    vehicleType: { type: String, default: 'Car', enum: ['Car', 'SUV', 'Hatchback', 'Bike', 'EV', 'Visitor'] },
    brand: { type: String, default: '' },
    color: { type: String, default: '' },

    blockId: { type: String, required: true, uppercase: true, index: true },
    blockName: { type: String, required: true },
    slotId: { type: String, required: true, uppercase: true, index: true },

    entryTime: { type: Date, required: true, index: true },
    exitTime: { type: Date, default: null },
    status: { type: String, enum: ['Parked', 'Exited'], default: 'Parked', index: true },

    source: { type: String, enum: ['ANPR', 'Manual', 'Demo'], default: 'ANPR' },
    cameraId: { type: String, default: '' },
    ocrConfidence: { type: Number, default: null },
    plateImage: { type: String, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
);

vehicleSchema.index({ entryTime: -1 });
vehicleSchema.index({ blockId: 1, slotId: 1 });
vehicleSchema.index({ status: 1, vehicleNumber: 1 });

const toPlain = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return { ...obj, id: String(obj._id || obj.id) };
};

module.exports = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);
module.exports.toPlain = toPlain;
