'use strict';

const jwt = require('jsonwebtoken');

const config = require('../config');
const { getStore } = require('../database');

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, name: user.name, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

function publicUser(user) {
  return {
    id: String(user.id),
    username: user.username,
    name: user.name,
    role: user.role,
    shift: user.shift || null,
    phone: user.phone || null,
  };
}

/** Rejects the request unless a valid Bearer token is present. */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const payload = jwt.verify(token, config.jwt.secret);
    const store = getStore();
    const user = await store.findUserById(payload.sub);
    if (!user) return res.status(401).json({ success: false, message: 'Account no longer exists' });
    req.user = user;
    req.token = token;
    return next();
  } catch (error) {
    const message = error.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Invalid token';
    return res.status(401).json({ success: false, message });
  }
}

module.exports = { signToken, publicUser, requireAuth };
