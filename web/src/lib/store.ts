"use client";

import { useSyncExternalStore } from "react";

// Tiny localStorage-backed store. Server render and first paint use the fallback; the real value
// syncs right after hydration. Swap `read`/`write` for API calls when the backend exists.
export function createStore<T>(key: string, fallback: T) {
  const listeners = new Set<() => void>();
  let cache: T | undefined;

  function read(): T {
    if (cache !== undefined) return cache;
    try {
      const raw = localStorage.getItem(key);
      cache = raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
      cache = fallback;
    }
    return cache!;
  }

  function set(next: T | ((prev: T) => T)) {
    cache = typeof next === "function" ? (next as (p: T) => T)(read()) : next;
    try { localStorage.setItem(key, JSON.stringify(cache)); } catch {}
    listeners.forEach((l) => l());
  }

  function subscribe(l: () => void) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => { if (e.key === key) { cache = undefined; l(); } };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
  }

  const use = () => useSyncExternalStore(subscribe, read, () => fallback);
  return { use, set, get: read, subscribe };
}
