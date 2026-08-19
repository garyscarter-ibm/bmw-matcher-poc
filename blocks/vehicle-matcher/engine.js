/*
 * Engine client for the vehicle-matcher block — the HTTP surface every mode shares (scoring
 * stays in server/). Failure differs by call: questions THROWS; nearby/preview resolve empty.
 */

/**
 * sessionStorage key holding the shared demo password the login overlay captured. The
 * real gate is the server's X-Access-Key check; this is just where the value is stashed.
 */
export const ACCESS_KEY_STORAGE = 'vmAccessKey';

/** Auth headers for every API call: the stored shared password as X-Access-Key, or
 * nothing when none is set (local dev and jsdom tests send no header; open server accepts). */
function authHeaders() {
  const key = (typeof sessionStorage !== 'undefined')
    ? sessionStorage.getItem(ACCESS_KEY_STORAGE)
    : null;
  return key ? { 'X-Access-Key': key } : {};
}

/**
 * A 401 means the shared password was wrong or rotated. Drop the stale value and tell the
 * host page to re-show its login overlay. Only apiGetQuestions acts on this; others degrade.
 */
function onUnauthorized() {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(ACCESS_KEY_STORAGE);
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('vm-auth-failed'));
  }
}

/** The quiz definition for a brand/retailer. Throws on failure — the caller
 * can't render an interface without it. */
export async function apiGetQuestions(base, retailer, brandKey) {
  const url = new URL(`${base}/api/questions`);
  if (retailer) url.searchParams.set('retailer', retailer);
  if (brandKey) url.searchParams.set('brand', brandKey);
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) onUnauthorized();
  if (!res.ok) throw new Error(`Questions request failed (${res.status})`);
  const data = await res.json();
  return { questions: data.questions };
}

/** The configured retailer's ranked matches for a set of answers. Throws on
 * failure — this is the primary result, not an enhancement. */
export async function apiMatch(base, answers, retailer, brandKey) {
  const res = await fetch(`${base}/api/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ answers, retailer, brand: brandKey }),
  });
  if (!res.ok) throw new Error(`Match request failed (${res.status})`);
  return res.json();
}

/**
 * Cars at other nearby retailers, a slower separate request so hero matches render first.
 * Failure → empty result; `unmet: null` means "couldn't tell", distinct from an empty list.
 */
export async function apiNearby(base, answers, retailer, brandKey) {
  const noAnswer = { nearby: [], unmet: null };
  try {
    const res = await fetch(`${base}/api/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ answers, retailer, brand: brandKey }),
    });
    if (!res.ok) return noAnswer;
    const data = await res.json();
    return {
      nearby: Array.isArray(data.nearby) ? data.nearby : [],
      unmet: (data.unmet && typeof data.unmet === 'object') ? data.unmet : null,
    };
  } catch {
    return noAnswer;
  }
}

/**
 * The retailer's current top matches for a live "best guess", refetched as answers change.
 * NEVER throws (error → []). `group` collapses repeat listings by model — opt-in per interface.
 */
export async function apiPreview(base, answers, retailer, brandKey, group = false) {
  try {
    const res = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        answers, retailer, brand: brandKey, group,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.matches) ? data.matches : [];
  } catch {
    return [];
  }
}

/**
 * The game modes' field — the roster a swipe deck or knockout bracket plays. Same engine/stock
 * as apiPreview but a wider `size` slice; `enrich` opts into per-card colour. NEVER throws (→ []).
 */
export async function apiField(base, answers, retailer, brandKey, size, enrich = false) {
  try {
    const res = await fetch(`${base}/api/field`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        answers, retailer, brand: brandKey, size, enrich,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.matches) ? data.matches : [];
  } catch {
    return [];
  }
}
