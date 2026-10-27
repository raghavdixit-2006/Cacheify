/**
 * Frontend runtime configuration.
 * The API now lives on a SEPARATE origin (the Express backend in ../backend).
 * NEXT_PUBLIC_API_URL points at it, e.g. http://127.0.0.1:3000 in dev.
 * Empty string = same-origin deployment (frontend and API share a host).
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

/** Absolute origin of the backend API (for connection strings shown to users). */
export function apiOrigin() {
  if (API_BASE) return API_BASE;
  if (typeof window !== 'undefined' && window.location.origin) return window.location.origin;
  return '';
}
