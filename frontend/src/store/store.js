/**
 * Tiny observable store (useSyncExternalStore friendly). Holds session and
 * shared flags; components subscribe. Logic lives here or in services, never
 * inside presentational components.
 */

import { SESSION_KEY } from '../utils/constants.js';

const listeners = new Set();

let state = {
  session: null, // { token, user }
};

function readStoredSession() {
  if (typeof window === 'undefined') return null; // SSR / prerender safety
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

/* Emit is keyed by a revision so useSyncExternalStore can diff cheaply. */
let revision = 0;

void (function hydrate() {
  const stored = readStoredSession();
  if (stored) {
    state = { ...state, session: stored };
  }
}());

export function getSession() {
  return state.session;
}

export function setSession(session) {
  state = { ...state, session };
  revision += 1;
  if (typeof window !== 'undefined') {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }
  emit();
}

export function updateUser(patch) {
  if (!state.session) return;
  return setSession({ ...state.session, user: { ...state.session.user, ...patch } });
}

/* First-login onboarding: until the profile is completed, the platform routes
   fresh accounts through the profile editor once. The skip decision lives in
   localStorage per user so it survives reloads and never bothers the same
   account twice. */
function onboardKey(userId) {
  return `cacheify.onboardSkip.${userId}`;
}

export function onboardingSkipped(userId) {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(onboardKey(userId)) === '1';
  } catch (_err) {
    return false;
  }
}

export function setOnboardingSkipped(userId) {
  try {
    localStorage.setItem(onboardKey(userId), '1');
  } catch (_err) {
    /* storage unavailable: onboarding simply repeats */
  }
}

/** useSyncExternalStore glue. Server snapshot is always the initial null. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function snapshot() {
  return revision;
}

function emit() {
  for (const listener of listeners) listener(state);
}
