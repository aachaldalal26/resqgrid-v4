'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { BellRing, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { CATEGORY_COLOR } from '@/lib/risk';
import type { Alert } from '@/lib/types';

/**
 * Shows new alerts as toasts + browser notifications.
 * Polls every 5 s; when Supabase is configured it also listens on Realtime for instant delivery.
 */
export default function AlertToaster() {
  const path = usePathname();
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Alert[]>([]);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch('/api/alerts?limit=10', { cache: 'no-store' });
        if (!res.ok) return;
        const list = (await res.json()) as Alert[];
        if (stop) return;
        if (!seen.current) {
          seen.current = new Set(list.map((a) => a.id)); // don't toast old alerts on first load
          return;
        }
        const fresh = list.filter((a) => !seen.current!.has(a.id));
        fresh.forEach((a) => seen.current!.add(a.id));
        if (!fresh.length) return;
        setToasts((cur) => [...fresh, ...cur].slice(0, 4));
        fresh.forEach((a) => setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== a.id)), 10_000));
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          fresh.slice(0, 2).forEach((a) => {
            try {
              new Notification(`ResQGrid: ${a.title}`, { body: a.message, tag: a.id });
            } catch {
              /* some browsers only allow notifications from a service worker */
            }
          });
        }
      } catch {
        /* offline */
      }
    };
    load();
    const id = setInterval(load, 5000);

    // Supabase Realtime (optional)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let cleanup = () => {};
    if (url && key) {
      const sb = createClient(url, key);
      const ch = sb.channel('alerts-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, () => load()).subscribe();
      cleanup = () => {
        sb.removeChannel(ch);
      };
    }
    return () => {
      stop = true;
      clearInterval(id);
      cleanup();
    };
  }, []);

  if (path.startsWith('/dashboard') || !toasts.length) return null;
  return (
    <div className="pointer-events-none fixed right-3 top-20 z-[2000] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="assertive">
      {toasts.map((a) => (
        <div key={a.id} className="animate-slide-in pointer-events-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="h-1.5" style={{ background: CATEGORY_COLOR[a.category] }} />
          <div className="flex gap-3 p-3.5">
            <BellRing className="mt-0.5 shrink-0" size={20} style={{ color: CATEGORY_COLOR[a.category] }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">
                {t('alertTitle', { category: t(`cat.${a.category}`), hazard: t(`hazard.${a.hazard}`), zone: a.zoneName })}
              </p>
              <p className="mt-0.5 line-clamp-3 text-xs text-slate-600">{a.message}</p>
            </div>
            <button onClick={() => setToasts((c) => c.filter((x) => x.id !== a.id))} aria-label="Dismiss" className="self-start text-slate-400 hover:text-slate-700">
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
