'use strict';

const bcrypt = require('bcryptjs');

const { getStore } = require('../database');
const { signToken, publicUser } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const store = getStore();
  const user = await store.findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
  const ok = await bcrypt.compare(String(password), user.password);
  if (!ok) {
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }

  await store.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
  return res.json({
    success: true,
    token: signToken(user),
    user: publicUser(user),
  });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

/** GET /api/auth/demo-accounts - shown on the login screen for the demo. */
const demoAccounts = asyncHandler(async (req, res) => {
  const store = getStore();
  const users = await store.listUsers();
  res.json({
    success: true,
    accounts: users.map((user) => ({
      username: user.username,
      role: user.role,
      name: user.name,
      password: user.username === 'admin' ? 'admin123' : 'watch123',
    })),
  });
});

module.exports = { login, me, demoAccounts };
