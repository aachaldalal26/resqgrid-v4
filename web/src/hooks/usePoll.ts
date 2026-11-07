'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveState } from '@/lib/types';

/**
 * Fetch JSON from `url` now and every `ms` milliseconds.
 * Works on weak internet: every good response is saved on the device, and if the
 * network fails the last saved copy is shown (`savedAt` tells you how old it is).
 */
export function usePoll<T>(url: string | null, ms = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const alive = useRef(true);
  const has = useRef(false);

  const load = useCallback(async () => {
    if (!url) return;
    const key = `rq_cache:${url}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      if (!alive.current) return;
      setData(json);
      setError(null);
      setSavedAt(null);
      has.current = true;
      try {
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), data: json }));
      } catch {
        /* storage full or blocked */
      }
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : String(e));
      try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null');
        if (cached) {
          if (!has.current) setData(cached.data as T);
          setSavedAt(cached.at);
        }
      } catch {
        /* ignore */
      }
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    load();
    const id = setInterval(load, ms);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [load, ms]);

  return { data, error, reload: load, savedAt };
}

export function useLiveState(ms = 4000) {
  return usePoll<LiveState>('/api/state', ms);
}
