// Everything the app keeps lives in this browser's localStorage, under these keys.
export const STORAGE_KEYS = {
  locale: "aa:locale",
  theme: "aa:theme",
  lite: "aa:lite",
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
