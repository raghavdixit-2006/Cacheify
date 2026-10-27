/**
 * Single API client for all services. Unwraps deterministic envelopes and
 * maps errors to ApiError { code, message, details, status }. Requests go to
 * the backend origin (API_BASE from config); CORS is without credentials.
 */

import { API_BASE } from '../utils/config.js';
import { getSession, setSession } from '../store/store.js';

export class ApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(method, path, { body = undefined, query = undefined } = {}) {
  const session = getSession();
  const headers = {};
  if (session && session.token) headers.authorization = `Bearer ${session.token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let url = `${API_BASE}${path}`;
  if (query) {
    const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''));
    const qs = params.toString();
    if (qs) url = `${url}?${qs}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (_err) {
    throw new ApiError(0, 'ERR_NETWORK', 'Network error: the service is unreachable');
  }

  const payload = await response.json().catch(() => null);

  if (response.status === 401 && getSession()) {
    setSession(null);
    window.location.assign('/login');
    throw new ApiError(401, 'ERR_UNAUTHORIZED', 'Your session has ended. Please sign in again.');
  }

  if (!response.ok || !payload || payload.success === false) {
    const error = (payload && payload.error) || {};
    throw new ApiError(
      response.status,
      error.code || 'ERR_REQUEST',
      error.message || `Request failed (${response.status})`,
      error.details,
    );
  }

  return { data: payload.data, meta: payload.meta || null };
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
};
