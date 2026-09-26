/**
 * Centralized API client for PolicyLens AI.
 * Handles authentication, errors, and response parsing.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

let accessToken = localStorage.getItem('pl_access_token');
let refreshToken = localStorage.getItem('pl_refresh_token');
let onAuthFailure = null;

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  if (access) localStorage.setItem('pl_access_token', access);
  else localStorage.removeItem('pl_access_token');
  if (refresh) localStorage.setItem('pl_refresh_token', refresh);
  else localStorage.removeItem('pl_refresh_token');
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('pl_access_token');
  localStorage.removeItem('pl_refresh_token');
}

export function setAuthFailureHandler(handler) {
  onAuthFailure = handler;
}

async function tryRefresh() {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`,
      },
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.success && json.data?.access_token) {
      setTokens(json.data.access_token, refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function request(method, path, { body, params, isFormData } = {}) {
  let url = `${BASE_URL}${path}`;

  if (params) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') search.set(k, v);
    });
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) {
    opts.body = isFormData ? body : JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (netErr) {
    throw new ApiError(
      'Network error. Please check your internet connection or server availability.',
      'NETWORK_ERROR',
      0,
      netErr.message
    );
  }

  // If 401, try refresh once
  if (res.status === 401 && refreshToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      try {
        res = await fetch(url, { ...opts, headers });
      } catch (netErr) {
        throw new ApiError(
          'Network error during retry.',
          'NETWORK_ERROR',
          0,
          netErr.message
        );
      }
    }
  }

  // If still 401, auth failure
  if (res.status === 401) {
    clearTokens();
    if (onAuthFailure) onAuthFailure();
    throw new ApiError('Authentication required. Session expired.', 'UNAUTHORIZED', 401);
  }

  // File download response (CSV, PDF, octet-stream)
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/csv') || ct.includes('application/pdf') || ct.includes('application/octet-stream')) {
    const blob = await res.blob();
    return { success: true, blob, filename: _extractFilename(res) };
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(
      `Server returned HTTP ${res.status} (${res.statusText || 'Non-JSON error'}).`,
      'SERVER_ERROR',
      res.status
    );
  }

  if (!res.ok || json.success === false) {
    const err = json.error || {};
    throw new ApiError(
      err.message || (res.status === 429 ? 'Rate limit exceeded. Please try again shortly.' : 'Request failed.'),
      err.code || (res.status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'ERROR'),
      res.status,
      err.details,
    );
  }

  return json;
}

function _extractFilename(res) {
  const cd = res.headers.get('content-disposition') || '';
  const match = cd.match(/filename=["']?([^"';]+)["']?/);
  return match ? match[1] : 'download';
}

export class ApiError extends Error {
  constructor(message, code, status, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
  upload: (path, formData) => request('POST', path, { body: formData, isFormData: true }),
};

export default api;
