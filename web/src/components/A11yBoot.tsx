'use client';
import { useEffect } from 'react';

/** Re-applies saved accessibility preferences (large text / high contrast) on load. */
export default function A11yBoot() {
  useEffect(() => {
    try {
      const root = document.documentElement;
      root.classList.toggle('large-text', localStorage.getItem('rq_large') === '1');
      root.classList.toggle('high-contrast', localStorage.getItem('rq_contrast') === '1');
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}

export function toggleA11y(kind: 'large' | 'contrast') {
  const cls = kind === 'large' ? 'large-text' : 'high-contrast';
  const on = document.documentElement.classList.toggle(cls);
  try {
    localStorage.setItem(kind === 'large' ? 'rq_large' : 'rq_contrast', on ? '1' : '0');
  } catch {
    /* ignore */
  }
  return on;
}
