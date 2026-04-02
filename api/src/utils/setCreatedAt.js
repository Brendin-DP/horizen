/**
 * UTC calendar day as a sortable number (year * 10000 + month * 100 + day).
 * @param {Date} d
 */
function utcYmdKey(d) {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/**
 * Validates set `createdAt` (performed/log date). Not on a future calendar day (UTC).
 * Uses date-only comparison so “today at local noon” is not rejected before noon local.
 * @param {string|undefined|null} value - ISO string from client; omit to use default
 * @param {string|null} defaultIso - when value is empty; null means required
 * @returns {{ ok: true, iso: string } | { ok: false, error: string }}
 */
export function normalizeSetCreatedAt(value, defaultIso) {
  if (value === undefined || value === null || value === '') {
    if (defaultIso == null) {
      return { ok: false, error: 'createdAt is required' };
    }
    return { ok: true, iso: defaultIso };
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: 'Invalid createdAt' };
  }
  const todayKey = utcYmdKey(new Date());
  if (utcYmdKey(d) > todayKey) {
    return { ok: false, error: 'createdAt cannot be in the future' };
  }
  return { ok: true, iso: d.toISOString() };
}
