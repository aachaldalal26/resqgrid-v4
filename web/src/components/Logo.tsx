export default function Logo({ dark = false, size = 36 }: { dark?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <defs>
          <linearGradient id="lg-rq" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <path d="M20 2 36 11v18L20 38 4 29V11z" fill="url(#lg-rq)" />
        <path d="M8 21h6l3-7 4 13 3-8 2 2h6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="leading-none">
        <span className={`block font-display text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-brand-900'}`}>
          ResQ<span className="text-cyan-500">Grid</span>
        </span>
        <span className={`block text-[10px] font-semibold uppercase tracking-[0.2em] ${dark ? 'text-cc-mute' : 'text-slate-500'}`}>by TerraPulse</span>
      </span>
    </span>
  );
}
