/**
 * Custom hooks encapsulating stateful/business logic.
 * Pages stay presentational: data fetching and lifecycle live here.
 */

import { useSyncExternalStore } from 'react';
import { getSession, subscribe } from '../store/store.js';
import { navigate } from '../router/navigate.js';

/** Reactive session for client components. null on the server snapshot. */
export function useSession() {
  return useSyncExternalStore(subscribe, getSession, () => null);
}

/**
 * Async data hook: run() fetches with race protection between invocations.
 * Returns { result, error, pending } through the callback.
 */
export function useAsyncTask(onChange) {
  let sequence = 0;
  return async function run(task) {
    const id = sequence + 1;
    sequence = id;
    onChange({ pending: true, error: null, result: null });
    try {
      const result = await task();
      if (id !== sequence) return null;
      onChange({ pending: false, error: null, result });
      return result;
    } catch (error) {
      if (id !== sequence) return null;
      onChange({ pending: false, error, result: null });
      return null;
    }
  };
}

export { navigate };
