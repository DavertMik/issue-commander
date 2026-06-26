// Tiny in-memory TTL cache for source lists (repos / milestones / projects).
// These change rarely; caching keeps the source selector snappy and survives
// browser refreshes (which clear the client-side React Query cache).

interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;
  const value = await fn();
  store.set(key, { value, expires: now + ttlMs });
  return value;
}
