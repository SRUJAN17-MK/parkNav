'use strict';

/**
 * MongoDB driver (Mongoose).
 *
 * Exposes exactly the same interface as backend/database/jsonStore.js so the
 * rest of the application never needs to know which database is running.
 */

const mongoose = require('mongoose');

const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const ParkingSlot = require('../models/ParkingSlot');
const CameraEvent = require('../models/CameraEvent');

const plainVehicle = Vehicle.toPlain;
const plainSlot = ParkingSlot.toPlain;
const plainEvent = CameraEvent.toPlain;

const plainUser = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return { ...obj, id: String(obj._id) };
};

class MongoStore {
  constructor(uri, options) {
    this.uri = uri;
    this.options = options;
    this.driver = 'mongodb';
    this.connection = null;
  }

  async connect() {
    mongoose.set('strictQuery', true);
    await mongoose.connect(this.uri, {
      serverSelectionTimeoutMS: this.options.mongoTimeoutMs,
      dbName: this.options.dbName,
    });
    this.connection = mongoose.connection;
    return this;
  }

  async disconnect() {
    await mongoose.disconnect();
  }

  async reset() {
    await Promise.all([User.deleteMany({}), Vehicle.deleteMany({}), ParkingSlot.deleteMany({}), CameraEvent.deleteMany({})]);
  }

  async isEmpty() {
    return (await User.estimatedDocumentCount()) === 0;
  }

  // ------------------------------------------------------------------ users
  async findUserByUsername(username) {
    return plainUser(await User.findOne({ username: String(username || '').toLowerCase() }).lean());
  }

  async findUserById(id) {
    return plainUser(await User.findById(id).lean());
  }

  async createUser(user) {
    return plainUser(await User.create(user));
  }

  async updateUser(id, patch) {
    return plainUser(await User.findByIdAndUpdate(id, patch, { new: true }).lean());
  }

  async listUsers() {
    return (await User.find().lean()).map(plainUser);
  }

  // --------------------------------------------------------------- vehicles
  async listVehicles() {
    return (await Vehicle.find().sort({ entryTime: -1 }).lean()).map(plainVehicle);
  }

  async findVehicleByNumber(vehicleNumber) {
    return plainVehicle(await Vehicle.findOne({ vehicleNumber: String(vehicleNumber || '').toUpperCase() }).lean());
  }

  async createVehicle(vehicle) {
    return plainVehicle(await Vehicle.create(vehicle));
  }

  async updateVehicleByNumber(vehicleNumber, patch) {
    return plainVehicle(
      await Vehicle.findOneAndUpdate(
        { vehicleNumber: String(vehicleNumber || '').toUpperCase() },
        patch,
        { new: true },
      ).lean(),
    );
  }

  // ------------------------------------------------------------------ slots
  async listSlots() {
    return (await ParkingSlot.find().sort({ slotId: 1 }).lean()).map(plainSlot);
  }

  async findSlot(slotId) {
    return plainSlot(await ParkingSlot.findOne({ slotId: String(slotId || '').toUpperCase() }).lean());
  }

  async updateSlot(slotId, patch) {
    return plainSlot(
      await ParkingSlot.findOneAndUpdate({ slotId: String(slotId || '').toUpperCase() }, patch, { new: true }).lean(),
    );
  }

  async insertSlots(slots) {
    await ParkingSlot.deleteMany({});
    await ParkingSlot.insertMany(slots);
    return this.listSlots();
  }

  // ----------------------------------------------------------------- events
  async listEvents() {
    return (await CameraEvent.find().sort({ createdAt: -1 }).lean()).map(plainEvent);
  }

  async createEvent(event) {
    return plainEvent(await CameraEvent.create(event));
  }
}

module.exports = MongoStore;
