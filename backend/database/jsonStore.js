'use strict';

/**
 * Zero-dependency file backed store.
 *
 * SmartPark must run on a fresh clone without installing MongoDB, so the JSON
 * driver implements exactly the same interface as the Mongoose driver.
 * Data lives in memory and is flushed to disk (atomically) after every write.
 */

const fs = require('fs');
const path = require('path');

const EMPTY = { users: [], vehicles: [], slots: [], events: [], meta: {} };

class JsonStore {
  constructor(file) {
    this.file = file;
    this.driver = 'json';
    this.data = JSON.parse(JSON.stringify(EMPTY));
  }

  async connect() {
    await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
    try {
      const raw = await fs.promises.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.data = { ...JSON.parse(JSON.stringify(EMPTY)), ...parsed };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`[db] ${this.file} is unreadable (${error.message}) - starting a fresh database.`);
      }
      this.data = JSON.parse(JSON.stringify(EMPTY));
      await this.flush();
    }
    return this;
  }

  async flush() {
    const payload = JSON.stringify(this.data, null, 2);
    // Atomic write (write temp + rename) where the platform allows it.
    try {
      const tmp = `${this.file}.tmp`;
      await fs.promises.writeFile(tmp, payload, 'utf8');
      await fs.promises.rename(tmp, this.file);
      return;
    } catch {
      // Windows can refuse the rename (EPERM) - fall back to a direct write.
    }
    await fs.promises.writeFile(this.file, payload, 'utf8');
  }

  /** Groups many writes into a single disk flush (used while seeding). */
  async beginBatch() {
    this.batching = true;
  }

  async endBatch() {
    this.batching = false;
    await this.persist();
  }

  async persist() {
    if (!this.batching) await this.flush();
  }

  nextId(collection) {
    const rows = this.data[collection];
    const max = rows.reduce((acc, row) => Math.max(acc, Number(row.id) || 0), 0);
    return String(max + 1);
  }

  async reset() {
    this.data = JSON.parse(JSON.stringify(EMPTY));
    await this.flush();
  }

  isEmpty() {
    return this.data.users.length === 0;
  }

  // ------------------------------------------------------------------ users
  async findUserByUsername(username) {
    const key = String(username || '').toLowerCase();
    const user = this.data.users.find((u) => u.username === key);
    return user ? { ...user } : null;
  }

  async findUserById(id) {
    const user = this.data.users.find((u) => String(u.id) === String(id));
    return user ? { ...user } : null;
  }

  async createUser(user) {
    const doc = { id: this.nextId('users'), ...user, createdAt: new Date().toISOString() };
    this.data.users.push(doc);
    await this.persist();
    return { ...doc };
  }

  async updateUser(id, patch) {
    const user = this.data.users.find((u) => String(u.id) === String(id));
    if (!user) return null;
    Object.assign(user, patch);
    await this.persist();
    return { ...user };
  }

  async listUsers() {
    return this.data.users.map((u) => ({ ...u }));
  }

  // --------------------------------------------------------------- vehicles
  async listVehicles() {
    return this.data.vehicles.map((v) => ({ ...v }));
  }

  async findVehicleByNumber(vehicleNumber) {
    const key = String(vehicleNumber || '').toUpperCase();
    const vehicle = this.data.vehicles.find((v) => v.vehicleNumber === key);
    return vehicle ? { ...vehicle } : null;
  }

  async createVehicle(vehicle) {
    const doc = { id: this.nextId('vehicles'), ...vehicle, createdAt: new Date().toISOString() };
    this.data.vehicles.push(doc);
    await this.persist();
    return { ...doc };
  }

  async updateVehicleByNumber(vehicleNumber, patch) {
    const key = String(vehicleNumber || '').toUpperCase();
    const vehicle = this.data.vehicles.find((v) => v.vehicleNumber === key);
    if (!vehicle) return null;
    Object.assign(vehicle, patch, { updatedAt: new Date().toISOString() });
    await this.persist();
    return { ...vehicle };
  }

  // ------------------------------------------------------------------ slots
  async listSlots() {
    return this.data.slots.map((s) => ({ ...s }));
  }

  async findSlot(slotId) {
    const key = String(slotId || '').toUpperCase();
    const slot = this.data.slots.find((s) => s.slotId === key);
    return slot ? { ...slot } : null;
  }

  async updateSlot(slotId, patch) {
    const key = String(slotId || '').toUpperCase();
    const slot = this.data.slots.find((s) => s.slotId === key);
    if (!slot) return null;
    Object.assign(slot, patch, { updatedAt: new Date().toISOString() });
    await this.persist();
    return { ...slot };
  }

  async insertSlots(slots) {
    this.data.slots = slots.map((slot) => ({ id: slot.id || this.nextId('slots'), ...slot }));
    await this.persist();
    return this.data.slots.map((s) => ({ ...s }));
  }

  // ----------------------------------------------------------------- events
  async listEvents() {
    return this.data.events.map((e) => ({ ...e }));
  }

  async createEvent(event) {
    const doc = {
      id: this.nextId('events'),
      ...event,
      createdAt: event.createdAt || new Date().toISOString(),
    };
    this.data.events.unshift(doc);
    this.data.events = this.data.events.slice(0, 300);
    await this.persist();
    return { ...doc };
  }
}

module.exports = JsonStore;
