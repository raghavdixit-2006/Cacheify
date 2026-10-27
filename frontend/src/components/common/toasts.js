/**
 * Toast state module (framework-free observable). Toasts.jsx subscribes and
 * renders inside the #app-toasts host; services/pages just push messages.
 */

const listeners = new Set();
let items = []; // [{ id, message, kind }]
let sequence = 0;

function emit() {
  for (const listener of listeners) listener();
}

export function showToast(message, kind = 'ok', { timeout = 3800 } = {}) {
  sequence += 1;
  const id = sequence;
  items = [...items, { id, message, kind }];
  emit();
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      items = items.filter((toast) => toast.id !== id);
      emit();
    }, timeout);
  }
}

export function showErrorToast(message) {
  showToast(message, 'error');
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts() {
  return items;
}
