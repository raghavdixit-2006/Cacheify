/**
 * Frontend runtime configuration.
 * The API lives on a SEPARATE origin (the Express backend in ../backend).
 * NEXT_PUBLIC_API_URL points at it — e.g. http://127.0.0.1:3000 in local dev
 * (frontend/.env.local) or the deployed API on https://cacheify.bot-keep.xyz.
 * An empty value means same-origin deployment (frontend and API share a host);
 * runtime calls in services/api.js then use relative paths.
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

/** Origin shown to users in example snippets (landing env sample, AI prompt,
 *  CLI copy box, manual blocks, the database page's connection string).
 *  Always an absolute origin of the API: when NEXT_PUBLIC_API_URL is not
 *  configured it falls back to the deployed API host, so public docs never
 *  display a localhost address. Distinct from API_BASE so runtime calls keep
 *  their same-origin semantics unchanged. */
export const API_EXAMPLE_ORIGIN = API_BASE || 'https://cacheify.bot-keep.xyz';

/** Absolute origin of the backend API (for connection strings shown to users). */
export function apiOrigin() {
  return API_EXAMPLE_ORIGIN;
}
