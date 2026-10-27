'use client';

/** Host for toast notifications; see toasts.js for state management. */

import { useSyncExternalStore } from 'react';
import { Toast } from './atoms.jsx';
import { getToasts, subscribe } from './toasts.js';

const EMPTY = [];

export default function Toasts() {
  const toasts = useSyncExternalStore(subscribe, getToasts, () => EMPTY);
  return (
    <div id="app-toasts" className="app-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} kind={toast.kind} />
      ))}
    </div>
  );
}
