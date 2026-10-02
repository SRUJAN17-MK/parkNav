'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Watchman / security guard account.
 * Passwords are stored as bcrypt hashes only.
 */
const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['watchman', 'admin'], default: 'watchman' },
    phone: { type: String, default: '' },
    shift: { type: String, default: 'Day' },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
