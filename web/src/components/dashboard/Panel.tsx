import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export default function Panel({ title, icon: Icon, right, children, className = '', bodyClass = 'p-4' }: {
  title: string; icon?: LucideIcon; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={`cc-panel flex min-h-0 flex-col ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-2.5">
        <h2 className="cc-title">
          {Icon && <Icon size={13} className="text-cyan-300" />}
          {title}
        </h2>
        {right}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
    </section>
  );
}
