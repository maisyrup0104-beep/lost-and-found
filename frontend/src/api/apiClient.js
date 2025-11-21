// src/api/apiClient.js
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

function debugLog(...args) {
  if (import.meta.env.DEV) console.debug('[apiClient]', ...args);
}

async function handleRes(res) {
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    const errMsg = data?.error || data?.message || `API error (status ${res.status})`;
    const err = new Error(errMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function getSavedToken() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('LAF__token');
  } catch (e) {
    return null;
  }
}

const fetchWithCreds = async (path, opts = {}) => {
  const url = `${API_BASE}${path}`;
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs || 12_000;

  const savedToken = getSavedToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {})
  };

  if (savedToken) {
    headers['Authorization'] = `Bearer ${savedToken}`;
  }

  const baseOpts = {
    credentials: 'include', // still include cookies if server uses them
    headers,
    signal: controller.signal,
    ...opts
  };

  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    debugLog('fetch', url, baseOpts.method || 'GET');
    const res = await fetch(url, baseOpts);
    clearTimeout(t);
    return await handleRes(res);
  } catch (networkErr) {
    clearTimeout(t);
    if (networkErr.name === 'AbortError') {
      const e = new Error('Request timed out');
      e.status = 0;
      throw e;
    }
    if (networkErr instanceof Error && networkErr.status) throw networkErr;
    console.error('Network error:', url, networkErr);
    const e = new Error(networkErr.message || 'Network error');
    throw e;
  }
};

// Form post helper (for multipart). Adds Authorization header if we have token.
const postFormWithCreds = async (path, formData, opts = {}) => {
  const url = `${API_BASE}${path}`;
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs || 20_000;

  const savedToken = getSavedToken();
  const headers = { ...(opts.headers || {}) };
  if (savedToken) {
    headers['Authorization'] = `Bearer ${savedToken}`;
  }

  const baseOpts = {
    credentials: 'include',
    method: opts.method || 'POST',
    body: formData,
    headers,
    signal: controller.signal,
    ...opts
  };

  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    debugLog('form-post', url, baseOpts.method || 'POST');
    const res = await fetch(url, baseOpts);
    clearTimeout(t);
    return await handleRes(res);
  } catch (networkErr) {
    clearTimeout(t);
    if (networkErr.name === 'AbortError') {
      const e = new Error('Request timed out');
      e.status = 0;
      throw e;
    }
    if (networkErr instanceof Error && networkErr.status) throw networkErr;
    console.error('Network error (form)', url, networkErr);
    const e = new Error(networkErr.message || 'Network error');
    throw e;
  }
};

export const api = {
  // AUTH
  register: (payload) => fetchWithCreds('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => fetchWithCreds('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => fetchWithCreds('/auth/logout', { method: 'POST' }),
  getMe: () => fetchWithCreds('/auth/me', { method: 'GET' }),
  updateProfile: (payload) => fetchWithCreds('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) }),
  changePassword: (payload) => fetchWithCreds('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) }),

  // HELPERS
  listUnits: () => fetchWithCreds('/units', { method: 'GET' }),
  listUnitsWithManagers: () => fetchWithCreds('/units/with-managers', { method: 'GET' }),

  listUsers: (opts = {}) => {
    // supports optional query as object, convert to query string if provided
    const qs = opts && Object.keys(opts).length ? '?' + new URLSearchParams(opts).toString() : '';
    return fetchWithCreds(`/admin/users${qs}`, { method: 'GET' });
  },

  // Units CRUD
  createUnit: (payload) => fetchWithCreds('/units', { method: 'POST', body: JSON.stringify(payload) }),
  updateUnit: (id, payload) => fetchWithCreds(`/units/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteUnit: (id) => fetchWithCreds(`/units/${id}`, { method: 'DELETE' }),

  // ADMIN (IT) helpers
  promoteUser: (payload) => fetchWithCreds('/admin/promote', { method: 'POST', body: JSON.stringify(payload) }),
  createManager: (payload) => fetchWithCreds('/admin/create-manager', { method: 'POST', body: JSON.stringify(payload) }),
  demoteUser: (payload) => fetchWithCreds('/admin/demote', { method: 'POST', body: JSON.stringify(payload) }),

  // FOUND / LOST / CLAIMS minimal helpers (some may be in your existing code)
  listPublicFound: async () => {
    const url = `${API_BASE}/found-items/public`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      const errMsg = data?.error || data?.message || 'Failed to fetch public found items';
      const err = new Error(errMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return await res.json();
  },

  createFound: (payload) => fetchWithCreds('/found-items', { method: 'POST', body: JSON.stringify(payload) }),
  getFoundById: (id) => fetchWithCreds(`/found-items/${id}`, { method: 'GET' }),
  createFoundForm: (formData, opts = {}) => postFormWithCreds('/found-items', formData, opts),

  managerInbox: () => fetchWithCreds('/found-items/manager/inbox', { method: 'GET' }),
  verifyFound: (id) => fetchWithCreds(`/found-items/${id}/verify`, { method: 'POST' }),
  publishFound: (id) => fetchWithCreds(`/found-items/${id}/publish`, { method: 'POST' }),

  createLostReport: (payload) => fetchWithCreds('/lost-reports', { method: 'POST', body: JSON.stringify(payload) }),
  myLostReports: () => fetchWithCreds('/lost-reports/me', { method: 'GET' }),
  getLostReportMatches: (id) => fetchWithCreds(`/lost-reports/matches/${id}`, { method: 'GET' }),
  createLostReportForm: (formData, opts = {}) => postFormWithCreds('/lost-reports', formData, opts),

  myClaims: () => fetchWithCreds('/claims/me', { method: 'GET' }),
  createClaim: (payload) => fetchWithCreds('/claims', { method: 'POST', body: JSON.stringify(payload) }),
  createClaimForm: (formData, opts = {}) => postFormWithCreds('/claims', formData, opts),

  managerPendingClaims: () => fetchWithCreds('/claims/manager/pending', { method: 'GET' }),
  approveClaim: (id, body = {}) => fetchWithCreds(`/claims/${id}/approve`, { method: 'POST', body: JSON.stringify(body) }),
  rejectClaim: (id, body = {}) => fetchWithCreds(`/claims/${id}/reject`, { method: 'POST', body: JSON.stringify(body) }),
  markClaimed: (id) => fetchWithCreds(`/claims/${id}/claimed`, { method: 'POST' }),

  _postFormWithCreds: postFormWithCreds
};