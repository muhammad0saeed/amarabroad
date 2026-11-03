// Everything the app keeps lives in this browser's localStorage, under these keys.
// Nothing is sent anywhere in Stage 1 (the Privacy page lists these keys).
export const STORAGE_KEYS = {
  locale: "aa:locale",
  theme: "aa:theme",
  lite: "aa:lite",
  profile: "aa:profile",
  saved: "aa:saved",
  compare: "aa:compare",
  comparisons: "aa:comparisons",
} as const;

export type ThemeChoice = "system" | "light" | "dark";

// localStorage can throw (private mode, blocked storage), so every access is guarded.
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not saved; the app still works for this visit.
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}
