type CacheEntry<T> = {
  value: T;
  exp: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export const QUOTE_TTL_MS = 60 * 60_000;
export const CHART_TTL_MS = 5 * 60_000;
export const DETAIL_TTL_MS = 5 * 60_000;

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (!hit) {
    return null;
  }
  if (hit.exp < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  store.set(key, { value, exp: Date.now() + ttlMs });
}
