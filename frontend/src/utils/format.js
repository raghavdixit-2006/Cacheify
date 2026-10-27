/** Escape / format helpers (pure functions). */

export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatTtl(ttlMs) {
  if (ttlMs === null || ttlMs === undefined) return 'No expiry';
  if (ttlMs <= 0) return 'Expired';
  const seconds = Math.round(ttlMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

/**
 * Tokenize a console line respecting single/double quotes.
 * Returns { command, args } in uppercase command form; null when empty.
 */
export function parseCommandLine(line) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match = re.exec(line.trim());
  while (match) {
    tokens.push(match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3]);
    match = re.exec(line.trim());
  }
  if (tokens.length === 0) return null;
  return { command: tokens[0].toUpperCase(), args: tokens.slice(1) };
}
