'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BellPlus, Contrast, Menu, Type, X } from 'lucide-react';
import Logo from './Logo';
import { LANGS, useI18n } from '@/i18n/I18nProvider';
import { toggleA11y } from './A11yBoot';

const LINKS = [
  { href: '/', key: 'nav.home' },
  { href: '/map', key: 'nav.map' },
  { href: '/report', key: 'nav.report' },
  { href: '/alerts', key: 'nav.alerts' },
  { href: '/prepare', key: 'nav.prepare' },
  { href: '/dashboard', key: 'nav.dashboard' },
];

export default function Header() {
  const path = usePathname();
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  if (path.startsWith('/dashboard')) return null;

  return (
    <header className="sticky top-0 z-[1000] border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="ResQGrid home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:text-brand-600'}`}
              >
                {t(l.key)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label={t('a11y.language')}>
            {LANGS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLang(l.id)}
                aria-pressed={lang === l.id}
                className={`rounded-md px-2 py-1 text-xs font-bold ${lang === l.id ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <Link href="/subscribe" className="hidden items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white shadow hover:bg-brand-600 sm:flex">
            <BellPlus size={15} /> {t('nav.subscribe')}
          </Link>
          <button onClick={() => toggleA11y('large')} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" title={t('a11y.largeText')} aria-label={t('a11y.largeText')}>
            <Type size={18} />
          </button>
          <button onClick={() => toggleA11y('contrast')} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" title={t('a11y.highContrast')} aria-label={t('a11y.highContrast')}>
            <Contrast size={18} />
          </button>
          <button className="rounded-lg p-2 text-slate-700 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden">
          {[...LINKS, { href: '/subscribe', key: 'nav.subscribe' }].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">
              {t(l.key)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
