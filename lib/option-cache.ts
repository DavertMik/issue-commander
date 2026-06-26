// Small localStorage cache for reference option lists (repo options, project
// status fields) so the F7 quick-edit popup and filters show choices instantly,
// then refresh in the background.

const PREFIX = "total-issues:opt:";

export function readCache<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writeCache(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full / unavailable — ignore
  }
}
