type CacheEntry<T> = {
  data?: T;
  at: number;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 60_000;

export function getCachedData<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry || entry.data === undefined) return null;
  if (Date.now() - entry.at > ttlMs) return null;
  return entry.data;
}

export function setCachedData<T>(key: string, data: T): T {
  cache.set(key, { data, at: Date.now() });
  return data;
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export async function cachedRequest<T>(
  key: string,
  loader: () => Promise<T>,
  options: { ttlMs?: number; force?: boolean } = {},
): Promise<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (!options.force && existing) {
    if (existing.data !== undefined && Date.now() - existing.at <= ttlMs) {
      return existing.data;
    }
    if (existing.promise) return existing.promise;
  }

  const promise = loader()
    .then((data) => setCachedData(key, data))
    .finally(() => {
      const current = cache.get(key) as CacheEntry<T> | undefined;
      if (current?.promise === promise) {
        cache.set(key, { data: current.data, at: current.at });
      }
    });

  cache.set(key, { data: existing?.data, at: existing?.at ?? 0, promise });
  return promise;
}

export function warmCachedRequest<T>(
  key: string,
  loader: () => Promise<T>,
  options: { ttlMs?: number } = {},
): void {
  void cachedRequest(key, loader, options).catch(() => undefined);
}
