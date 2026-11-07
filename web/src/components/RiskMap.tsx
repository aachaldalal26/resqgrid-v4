'use client';
/**
 * Leaflet risk map. Import it with next/dynamic({ ssr: false }) - see MapView.tsx.
 * To switch to Google Maps later, re-implement this one component with the same props.
 */
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { useEffect } from 'react';
import { CITY_CENTER, DEFAULT_ZOOM } from '@/data/zones';
import { CATEGORY_COLOR } from '@/lib/risk';
import type { Report, Resource, ZoneState } from '@/lib/types';

export interface RiskMapProps {
  zones: ZoneState[];
  resources?: Resource[];
  reports?: Report[];
  route?: [number, number][] | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  dark?: boolean;
  userPos?: [number, number] | null;
  pin?: [number, number] | null;
  onMapClick?: (p: [number, number]) => void;
  zoom?: number;
  focus?: [number, number] | null;
  focusZoom?: number;
  /** Satellite imagery basemap (Esri World Imagery) */
  satellite?: boolean;
}

const RES_STYLE = {
  shelter: { bg: '#2563eb', ch: 'S' },
  hospital: { bg: '#db2777', ch: 'H' },
  rescue: { bg: '#7c3aed', ch: 'R' },
} as const;

function resIcon(type: Resource['type'], status: Resource['status']) {
  const s = RES_STYLE[type];
  return L.divIcon({
    className: '',
    html: `<div class="res-pin" style="background:${s.bg};opacity:${status === 'full' ? 0.45 : 1}">${s.ch}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function ClickCatcher({ onClick }: { onClick: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onClick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

function FlyTo({ focus, zoom }: { focus?: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo(focus, Math.max(map.getZoom(), zoom), { duration: 0.8 });
  }, [focus, map, zoom]);
  return null;
}

export default function RiskMap({
  zones, resources, reports, route, selectedId, onSelect, dark, userPos, pin, onMapClick, zoom = DEFAULT_ZOOM, focus, focusZoom = 9, satellite = false,
}: RiskMapProps) {
  // No API keys needed: OpenStreetMap tiles (dark mode = same tiles with a CSS dark filter)
  // and Esri World Imagery for the satellite layer.
  const tiles = satellite
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution = satellite
    ? 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const darkTiles = dark && !satellite;

  return (
    <MapContainer center={CITY_CENTER} zoom={zoom} className="h-full w-full" scrollWheelZoom zoomControl>
      <style>{`.rq-dark-tiles { filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.5); }`}</style>
      <TileLayer key={tiles + darkTiles} url={tiles} attribution={attribution} maxZoom={19} className={darkTiles ? 'rq-dark-tiles' : ''} />
      <FlyTo focus={focus} zoom={focusZoom} />

      {zones.map((z) => {
        const c = CATEGORY_COLOR[z.risk.category];
        const sel = z.id === selectedId;
        const fill = z.risk.category === 'Critical' ? 0.55 : z.risk.category === 'High' ? 0.45 : z.risk.category === 'Moderate' ? 0.32 : 0.22;
        return (
          <Polygon
            key={`${z.id}-${z.risk.category}-${sel ? 1 : 0}`}
            positions={z.polygon}
            pathOptions={{
              color: sel ? (dark ? '#ffffff' : '#0b1f4d') : c,
              weight: sel ? 3.5 : 1.5,
              fillColor: c,
              fillOpacity: fill,
              className: z.risk.category === 'Critical' ? 'zone-critical' : '',
            }}
            eventHandlers={{ click: () => onSelect?.(z.id) }}
          >
            <Tooltip direction="top" sticky>
              <strong>{z.name}</strong>, {z.state} · {z.risk.overall}/100 · {z.risk.category}
            </Tooltip>
          </Polygon>
        );
      })}

      {/* Centre dots keep every zone visible and clickable on the all-India view */}
      {zones.map((z) => (
        <CircleMarker
          key={`dot-${z.id}-${z.risk.category}`}
          center={[z.lat, z.lng]}
          radius={z.id === selectedId ? 9 : 6}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: CATEGORY_COLOR[z.risk.category], fillOpacity: 1 }}
          eventHandlers={{ click: () => onSelect?.(z.id) }}
        >
          <Tooltip direction="top">
            <strong>{z.name}</strong>, {z.state} · {z.risk.overall}/100 · {z.risk.category}
          </Tooltip>
        </CircleMarker>
      ))}

      {route && route.length > 1 && (
        <>
          <Polyline positions={route} pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }} />
          <Polyline positions={route} pathOptions={{ color: dark ? '#22d3ee' : '#2563eb', weight: 5 }} />
        </>
      )}

      {resources?.map((r) => (
        <Marker key={r.id} position={[r.lat, r.lng]} icon={resIcon(r.type, r.status)}>
          <Tooltip direction="top">
            <strong>{r.name}</strong>
            <br />
            {r.status}
            {r.capacity ? ` · ${r.occupied}/${r.capacity}` : ''}
          </Tooltip>
        </Marker>
      ))}

      {reports?.map((r) => (
        <CircleMarker
          key={r.id}
          center={[r.lat, r.lng]}
          radius={6}
          pathOptions={{
            color: '#fff',
            weight: 2,
            fillColor: r.status === 'verified' ? '#dc2626' : r.status === 'pending' ? '#f59e0b' : '#64748b',
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="top">
            {r.hazard} report · {r.status}
            {r.description ? <><br />{r.description.slice(0, 80)}</> : null}
          </Tooltip>
        </CircleMarker>
      ))}

      {userPos && <CircleMarker center={userPos} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }} />}
      {pin && <CircleMarker center={pin} radius={10} pathOptions={{ color: '#fff', weight: 3, fillColor: '#dc2626', fillOpacity: 1 }} />}
      {onMapClick && <ClickCatcher onClick={onMapClick} />}
    </MapContainer>
  );
}
