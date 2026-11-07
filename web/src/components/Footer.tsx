import Link from 'next/link';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="bg-[#050b1c] text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo dark />
          <p className="mt-4 max-w-xs text-sm">Predict the Risk. Alert the Community. Act Before Disaster.</p>
          <p className="mt-3 text-xs">Team TerraPulse · I²IT Pune · PCCOE International Grand Challenge 2026</p>
        </div>
        <FooterCol title="Product" links={[['/map', 'Live risk map'], ['/alerts', 'Alerts'], ['/report', 'Report a hazard'], ['/prepare', 'Prepare & practice']]} />
        <FooterCol title="For organisations" links={[['/subscribe?group=schools', 'Schools & colleges'], ['/subscribe?group=vulnerable', 'Vulnerable communities'], ['/dashboard', 'Authority command center'], ['/developers', 'Open data API for NGOs']]} />
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-300">Emergency</p>
          <ul className="space-y-1.5 text-sm">
            <li><a className="hover:text-white" href="tel:112">112 · National emergency</a></li>
            <li><a className="hover:text-white" href="tel:1078">1078 · NDMA disaster helpline</a></li>
            <li><a className="hover:text-white" href="tel:108">108 · Ambulance</a></li>
            <li><a className="hover:text-white" href="tel:101">101 · Fire</a></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-white/5 py-4 text-center text-[11px]">
        Weather © Open-Meteo · Maps © OpenStreetMap, Esri · Official advisories shown are a demo feed · Always follow instructions from local authorities.
      </p>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-300">{title}</p>
      <ul className="space-y-1.5 text-sm">
        {links.map(([href, label]) => (
          <li key={href}><Link href={href} className="hover:text-white">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
