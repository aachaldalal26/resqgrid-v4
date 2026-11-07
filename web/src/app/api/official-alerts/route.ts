import { NextResponse } from 'next/server';
import feed from '@/data/official-alerts.json';
import { getSim } from '@/lib/engine';
import type { OfficialAlert } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Mock adapter for IMD / NDMA / CWC advisories.
 * Replace `feed` with a real fetch (e.g. IMD nowcast RSS / CAP feed) - keep the same shape.
 * During a simulation an extra matching advisory is injected so the demo feels real.
 */
export async function GET() {
  const items = [...(feed as OfficialAlert[])];
  const sim = await getSim();
  if (sim.active && sim.scenario) {
    const injected: Record<string, OfficialAlert> = {
      'monsoon-flood': { id: 'sim-imd', agency: 'IMD + CWC', level: 'Red', hazard: 'flood', title: 'Red alert: extremely heavy rainfall – Konkan, Kerala, Assam & Bihar', detail: 'Brahmaputra, Ganga and Periyar above danger mark. Residents in low-lying areas to move to relief camps. (Simulation)', validUntil: 'Next 24 hours', source: 'Simulated advisory' },
      cyclone: { id: 'sim-imd', agency: 'IMD + NDMA', level: 'Red', hazard: 'storm', title: 'Severe cyclonic storm: landfall near Puri, Odisha', detail: 'Winds 130–150 km/h gusting higher, storm surge 1–2 m. Coastal evacuation ordered for Odisha and north Andhra. (Simulation)', validUntil: 'Next 36 hours', source: 'Simulated advisory' },
      heatwave: { id: 'sim-imd', agency: 'IMD', level: 'Orange', hazard: 'heatwave', title: 'Severe heatwave: Delhi, Rajasthan, Uttar Pradesh & central India', detail: 'Max temperatures 44–47°C expected. Avoid outdoor exposure 12–4 pm. (Simulation)', validUntil: 'Next 72 hours', source: 'Simulated advisory' },
      'ghat-landslide': { id: 'sim-ndma', agency: 'NDMA + GSI', level: 'Red', hazard: 'landslide', title: 'Landslide warning: Uttarakhand, Himachal, Sikkim & Wayanad', detail: 'Cloudbursts reported. Avoid hill slopes and ghat roads; several highways closed. (Simulation)', validUntil: 'Until cleared', source: 'Simulated advisory' },
    };
    items.unshift(injected[sim.scenario]);
  }
  return NextResponse.json(items);
}
