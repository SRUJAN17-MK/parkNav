/**
 * SmartPark - API client.
 *
 * A thin fetch wrapper that:
 *   - injects the JWT from localStorage
 *   - normalises { success, message } envelopes into thrown Errors
 *   - redirects to the login screen on an expired session
 */

const BASE = import.meta.env.VITE_API_BASE || '/api';
const TOKEN_KEY = 'smartpark.token';
const USER_KEY = 'smartpark.user';

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  user: () => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
};

let onUnauthorized = null;
/** Lets the auth provider react to an expired / revoked session. */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(path, { method = 'GET', body, signal, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      'Cannot reach the SmartPark API. Make sure the backend is running on port 5000.',
      0,
      null,
    );
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      tokenStore.clear();
      if (onUnauthorized) onUnauthorized(payload?.message || 'Session expired');
    }
    throw new ApiError(payload?.message || `Request failed (${response.status})`, response.status, payload);
  }

  return payload;
}

const qs = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : '';
};

export const api = {
  // ----------------------------------------------------------------- auth
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: { username, password }, auth: false }),
  demoAccounts: () => request('/auth/demo-accounts', { auth: false }),
  me: () => request('/auth/me'),

  // ------------------------------------------------------------ dashboard
  stats: (signal) => request('/dashboard/stats', { signal }),

  // -------------------------------------------------------------- parking
  map: (signal) => request('/parking/map', { signal }),
  slots: (params, signal) => request(`/parking/slots${qs(params)}`, { signal }),
  slot: (slotId, signal) => request(`/parking/slots/${encodeURIComponent(slotId)}`, { signal }),
  blocks: (signal) => request('/parking/blocks', { signal }),
  nextAvailable: (vehicleType, signal) =>
    request(`/parking/next-available${qs({ vehicleType })}`, { signal }),

  // ------------------------------------------------------------- vehicles
  searchVehicles: (params, signal) => request(`/vehicles/search${qs(params)}`, { signal }),
  vehicle: (vehicleNumber, signal) =>
    request(`/vehicles/${encodeURIComponent(vehicleNumber)}`, { signal }),
  history: (params, signal) => request(`/vehicles/history${qs(params)}`, { signal }),
  recordEntry: (payload) => request('/vehicles/entry', { method: 'POST', body: payload }),
  recordExit: (payload) => request('/vehicles/exit', { method: 'POST', body: payload }),

  // ----------------------------------------------------------- navigation
  route: (params, signal) => request(`/navigation/route${qs(params)}`, { signal }),
  distances: (signal) => request('/navigation/distances', { signal }),
  graph: (signal) => request('/navigation/graph', { signal }),

  // --------------------------------------------------------------- camera
  cameraStatus: (signal) => request('/camera/status', { signal }),
  simulateEntry: (payload) => request('/camera/simulate-entry', { method: 'POST', body: payload }),
  simulateExit: (payload) => request('/camera/simulate-exit', { method: 'POST', body: payload }),
  readPlate: (payload) => request('/camera/ocr', { method: 'POST', body: payload }),
};
