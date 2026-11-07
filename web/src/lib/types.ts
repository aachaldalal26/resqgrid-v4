// Shared types used across the ResQGrid web app.

export type Hazard = 'flood' | 'landslide' | 'heatwave' | 'storm';
export type ReportHazard = Hazard | 'fire' | 'other';
export type Category = 'Low' | 'Moderate' | 'High' | 'Critical';
export type ScenarioId = 'monsoon-flood' | 'heatwave' | 'ghat-landslide' | 'cyclone';
export type Role = 'citizen' | 'authority';

export interface ZoneDef {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  river?: string;
  distRiverKm: number;
  slopeDeg: number;
  floodProne: boolean;
  /** metres above the local flood level / river bed */
  reliefM: number;
  population: number;
}

/** Model inputs for one zone (same names as the Python service). */
export interface ZoneInputs {
  rain24hPast: number;
  rain24hForecast: number;
  rainMaxHourly: number;
  dischargeRatio: number;
  tempMax: number;
  windGustMax: number;
  elevationRel: number;
  distRiverKm: number;
  slopeDeg: number;
  floodProne: number;
  verifiedReports: number;
  officialAlert: number;
  /** IoT sensor alarm level: 0 none, 1 warning, 2 danger */
  sensorAlarm?: number;
}

export interface Factor { feature: string; label: string; impact: number }
export type HazardScores = Record<Hazard, number>;

export interface ZoneRisk {
  scores: HazardScores;
  overall: number;
  category: Category;
  primaryHazard: Hazard;
  factors: Factor[];
  reason: string;
  anomaly: boolean;
  anomalyNote?: string | null;
  source: 'ml' | 'rules';
}

export interface ForecastPoint { time: string; rain: number; temp: number }

export interface ZoneState extends ZoneDef {
  polygon: [number, number][];
  inputs: ZoneInputs;
  risk: ZoneRisk;
  forecast: ForecastPoint[];
}

export interface Alert {
  id: string;
  zoneId: string | null;
  zoneName: string;
  hazard: ReportHazard | 'general';
  category: Category;
  title: string;
  message: string;
  source: 'auto' | 'authority';
  createdAt: string;
  /** Who the alert is for (default: everyone in the area) */
  audience?: Audience;
  /** How many subscribers it reached, per channel */
  reach?: Reach | null;
}

export type Audience = 'all' | 'residents' | 'schools' | 'vulnerable' | 'responders' | 'ngos';
export type Channel = 'push' | 'sms' | 'email' | 'whatsapp';
export interface Reach { subscribers: number; channels: Partial<Record<Channel, number>> }

export interface Subscription {
  id: string;
  name: string;
  zoneId: string;
  group: Exclude<Audience, 'all'>;
  channels: Channel[];
  contact: string;
  createdAt: string;
}

export interface SensorStation {
  id: string;
  zoneId: string;
  zoneName: string;
  type: 'rain' | 'river' | 'temp';
  label: string;
  unit: string;
  value: number;
  warning: number;
  danger: number;
  status: 'normal' | 'warning' | 'danger';
  history: number[];
  source: 'virtual' | 'device';
  updatedAt: string;
}

export interface Report {
  id: string;
  hazard: ReportHazard;
  description: string;
  lat: number;
  lng: number;
  zoneId: string | null;
  zoneName: string;
  photoUrl: string | null;
  aiLabel: string | null;
  aiConfidence: number | null;
  aiMethod: string | null;
  verificationScore: number;
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
}

export interface Resource {
  id: string;
  type: 'shelter' | 'hospital' | 'rescue';
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  occupied: number;
  status: 'available' | 'busy' | 'full' | 'deployed';
  zoneId?: string | null;
}

export interface Snapshot { at: string; zoneId: string; overall: number; category: Category }

export interface SimState { active: boolean; scenario: ScenarioId | null; startedAt: number | null }

export interface WeatherMeta {
  source: 'open-meteo' | 'fallback';
  fetchedAt: number;
  delayed: boolean;
  error?: string;
}

export interface CityStats {
  avg: number;
  max: number;
  highCount: number;
  criticalCount: number;
  peopleAtRisk: number;
  anomalies: number;
}

export interface LiveState {
  zones: ZoneState[];
  updatedAt: string;
  weather: WeatherMeta;
  sim: SimState & { intensity: number };
  ml: boolean;
  city: CityStats;
}

export interface OfficialAlert {
  id: string;
  agency: string;
  level: string;
  hazard: string;
  title: string;
  detail: string;
  validUntil: string;
  source: string;
}
