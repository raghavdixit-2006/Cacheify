/** Auth service: session lifecycle only. */

import { api } from './api.js';
import { getSession, setSession, updateUser } from '../store/store.js';

export function register({ email, password }) {
  return api.post('/api/auth/register', { email, password });
}

export function login({ email, password }) {
  return api.post('/api/auth/login', { email, password });
}

/* Email verification (Brevo OTP flow). */
export function requestOtp() {
  return api.post('/api/auth/otp/request', {});
}

export function verifyOtp(code) {
  return api.post('/api/auth/otp/verify', { code });
}

export function startSession({ token, user }) {
  setSession({ token, user });
}

export function logout() {
  setSession(null);
}

export async function refreshSession() {
  if (!getSession()) return null;
  const { data } = await api.get('/api/auth/me');
  updateUser(data.user);
  return data.user;
}

/** Load a database by public id. Kept here to avoid a circular import for pages. */
export function getDatabase(id) {
  return api.get(`/api/databases/${id}`);
}
