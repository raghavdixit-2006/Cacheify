/** Client-side validators (mirror server rules; server remains the authority). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  const value = String(email || '').trim();
  if (!value) return 'Email is required';
  if (value.length > 254) return 'Email is too long';
  if (!EMAIL_RE.test(value)) return 'Enter a valid email address';
  return null;
}

export function validatePassword(password) {
  const value = String(password || '');
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Must be at least 8 characters';
  if (value.length > 128) return 'Must be at most 128 characters';
  return null;
}

export function validateRequired(value, label = 'This field') {
  if (!String(value || '').trim()) return `${label} is required`;
  return null;
}

export function validateDatabaseName(name) {
  const value = String(name || '').trim();
  if (!value) return 'Name is required';
  if (value.length > 64) return 'Must be at most 64 characters';
  return null;
}

/** Profile text caps (displayName <= 80, bio <= 500); mirrors server caps. */
export function validateProfileText(text, max) {
  const value = String(text || '');
  if (!value) return null;
  if (value.length > max) return `Must be at most ${max} characters`;
  return null;
}

/** Extract a safe, actionable message from an API error envelope. */
export function errorToMessage(err, fallback = 'Something went wrong') {
  if (!err) return fallback;
  if (err.details && err.details.length > 0) {
    return err.details.map((detail) => `${detail.field}: ${detail.issue}`).join('. ');
  }
  return err.message || fallback;
}
