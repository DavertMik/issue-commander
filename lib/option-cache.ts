// Small localStorage cache for reference option lists (source lists, repo options,
// project status fields) so selectors and the F7 quick-edit popup show choices
// instantly, and only re-fetch once the cached copy has gone stale.

const PREFIX = "total-issues:opt:";
const TS_SUFFIX = ":ts";

export function readCache<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** When the entry was written (epoch ms); 0 = never/unknown, i.e. always stale. */
export function readCacheTime(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const t = Number(window.localStorage.getItem(PREFIX + key + TS_SUFFIX));
    return Number.isFinite(t) && t > 0 ? t : 0;
  } catch {
    return 0;
  }
}

export function writeCache(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    window.localStorage.setItem(PREFIX + key + TS_SUFFIX, String(Date.now()));
  } catch {
    // storage full / unavailable — ignore
  }
}
