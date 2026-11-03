"use client";

// Small localStorage-backed stores shared by every component, kept in sync across tabs.
// Server rendering always sees the fallback; the saved value appears right after hydration.

import { useSyncExternalStore } from "react";
import { COMPARE_MAX } from "./filters";
import { parseProfile } from "./profile";
import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from "./storage";
import type { StudentProfile } from "@/types";

type Listener = () => void;

export interface Store<T> {
  get(): T;
  set(next: T | ((previous: T) => T)): void;
  clear(): void;
  subscribe(listener: Listener): () => void;
  fallback: T;
}

function createStore<T>(key: string, fallback: T, parse: (raw: unknown) => T | null): Store<T> {
  let cache: { raw: string | null; value: T } | null = null;
  const listeners = new Set<Listener>();
  const notify = () => {
    cache = null;
    listeners.forEach((l) => l());
  };

  return {
    fallback,
    get() {
      const raw = readStorage(key);
      if (cache && cache.raw === raw) return cache.value;
      let value = fallback;
      if (raw) {
        try {
          value = parse(JSON.parse(raw)) ?? fallback;
        } catch {
          value = fallback;
        }
      }
      cache = { raw, value };
      return value;
    },
    set(next) {
      const value = typeof next === "function" ? (next as (p: T) => T)(this.get()) : next;
      writeStorage(key, JSON.stringify(value));
      notify();
    },
    clear() {
      removeStorage(key);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) {
          cache = null;
          listener();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}

const slugList = (max: number) => (raw: unknown) =>
  Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === "string"))].slice(0, max) : null;

export interface SavedComparison {
  ids: string[];
  saved_on: string;
}

export const profileStore = createStore<StudentProfile | null>(STORAGE_KEYS.profile, null, parseProfile);
export const savedStore = createStore<string[]>(STORAGE_KEYS.saved, [], slugList(200));
export const compareStore = createStore<string[]>(STORAGE_KEYS.compare, [], slugList(COMPARE_MAX));
export const comparisonsStore = createStore<SavedComparison[]>(STORAGE_KEYS.comparisons, [], (raw) =>
  Array.isArray(raw)
    ? raw
        .filter((c): c is SavedComparison => !!c && Array.isArray(c.ids) && typeof c.saved_on === "string")
        .map((c) => ({ ids: c.ids.filter((x) => typeof x === "string").slice(0, COMPARE_MAX), saved_on: c.saved_on }))
        .slice(0, 50)
    : null,
);

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe.bind(store), store.get.bind(store), () => store.fallback);
}

const noop = () => () => {};
/** False during server rendering and hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function toggleIn(list: string[], slug: string, max = Infinity): string[] {
  if (list.includes(slug)) return list.filter((s) => s !== slug);
  return list.length >= max ? list : [...list, slug];
}
