'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Parking slot collection. Seeded from backend/data/layout.js so the map and
 * the database can never disagree about how many slots exist.
 */
const parkingSlotSchema = new Schema(
  {
    slotId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    blockId: { type: String, required: true, uppercase: true, index: true },
    blockName: { type: String, required: true },
    row: { type: Number, default: 0 },
    col: { type: Number, default: 0 },
    type: { type: String, enum: ['standard', 'ev', 'visitor'], default: 'standard' },

    status: { type: String, enum: ['Occupied', 'Empty'], default: 'Empty', index: true },
    vehicleNumber: { type: String, default: null, index: true },
    vehicleId: { type: String, default: null },
    entryTime: { type: Date, default: null },

    // Computer-vision occupancy (future: live camera slot detection)
    cvOccupied: { type: Boolean, default: null },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

const toPlain = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return { ...obj, id: String(obj._id || obj.id) };
};

module.exports = mongoose.models.ParkingSlot || mongoose.model('ParkingSlot', parkingSlotSchema);
module.exports.toPlain = toPlain;
