'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import en from './en.json';
import hi from './hi.json';
import mr from './mr.json';

const DICTS = { en, hi, mr } as const;
export type Lang = keyof typeof DICTS;
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'hi', label: 'हिं' },
  { id: 'mr', label: 'मरा' },
];

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tips: (hazard: string) => string[];
};
const I18nCtx = createContext<Ctx | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lookup(obj: any, path: string): unknown {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rq_lang') as Lang | null;
      if (saved && saved in DICTS) setLangState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('rq_lang', l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = lookup(DICTS[lang], key) ?? lookup(en, key);
      if (typeof s !== 'string') return key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = (s as string).replaceAll(`{${k}}`, String(v));
      return s as string;
    },
    [lang],
  );

  const tips = useCallback(
    (hazard: string) => {
      const v = lookup(DICTS[lang], `safety.${hazard}`) ?? lookup(en, `safety.${hazard}`) ?? lookup(en, 'safety.other');
      return Array.isArray(v) ? (v as string[]) : [];
    },
    [lang],
  );

  return <I18nCtx.Provider value={{ lang, setLang, t, tips }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error('useI18n must be used inside I18nProvider');
  return c;
}
