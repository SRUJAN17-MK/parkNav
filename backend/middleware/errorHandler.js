'use strict';

/** 404 handler for unknown API routes. */
function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/** Central error handler - keeps API responses consistent. */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  const status = error.status || 500;
  if (status >= 500) {
    console.error(`[api] ${req.method} ${req.originalUrl} ->`, error);
  }
  const body = { success: false, message: error.message || 'Internal server error' };
  if (error.current) body.current = error.current;
  if (process.env.NODE_ENV !== 'production' && status >= 500) body.stack = error.stack;
  res.status(status).json(body);
}

/** Wraps async route handlers so rejected promises reach the error handler. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { notFound, errorHandler, asyncHandler };
