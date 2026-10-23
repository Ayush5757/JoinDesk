/**
 * A tiny in-memory cache with an expiry time.
 *
 * On a serverless host (Vercel) a warm server keeps its memory between requests, so things that
 * every request asks for but that rarely change (is this user blocked? what are the payment
 * settings?) can be remembered for a few seconds instead of asking the database each time.
 * Every entry expires on its own, so a change is seen everywhere within `ttlMs` at the latest,
 * and the instance that made the change forgets it immediately via `forget`.
 */
const store = new Map();
const MAX_ENTRIES = 5000;

export async function remember(key, ttlMs, load) {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.until > now) return hit.value;
  const value = await load();
  if (store.size >= MAX_ENTRIES) store.clear(); // never grow without limit
  store.set(key, { value, until: now + ttlMs });
  return value;
}

/** Forget one key, or every key that starts with `prefix`. */
export function forget(keyOrPrefix) {
  if (store.has(keyOrPrefix)) store.delete(keyOrPrefix);
  for (const k of store.keys()) if (k.startsWith(keyOrPrefix)) store.delete(k);
}

export function clearCache() {
  store.clear();
}
