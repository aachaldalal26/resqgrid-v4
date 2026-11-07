/**
 * Data store with two interchangeable backends:
 *   - LocalStore    : JSON file in web/.data (zero setup, perfect for a laptop demo)
 *   - SupabaseStore : Supabase Postgres + Storage (used automatically when env vars are set)
 * Server-side only.
 */
import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Alert, Report, Resource, Snapshot } from './types';
import defaultResources from '@/data/resources.json';

export interface Store {
  kind: 'local' | 'supabase';
  getState<T>(key: string): Promise<T | null>;
  setState(key: string, value: unknown): Promise<void>;
  listReports(): Promise<Report[]>;
  addReport(r: Report): Promise<void>;
  updateReport(id: string, patch: Partial<Report>): Promise<Report | null>;
  listAlerts(limit?: number): Promise<Alert[]>;
  addAlert(a: Alert): Promise<void>;
  listResources(): Promise<Resource[]>;
  updateResource(id: string, patch: Partial<Resource>): Promise<Resource | null>;
  listSnapshots(sinceIso: string): Promise<Snapshot[]>;
  addSnapshots(s: Snapshot[]): Promise<void>;
  savePhoto(id: string, buf: Buffer, contentType: string): Promise<string>;
}

const DEFAULT_RESOURCES = defaultResources as Resource[];
const MAX_SNAPSHOTS = 40 * 400;

// ------------------------------------------------------------------ local JSON store
interface LocalDB {
  reports: Report[];
  alerts: Alert[];
  resources: Resource[];
  snapshots: Snapshot[];
  state: Record<string, unknown>;
}

export function dataDir() {
  return process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/resqgrid' : path.join(process.cwd(), '.data'));
}

class LocalStore implements Store {
  kind = 'local' as const;
  private file: string;
  private db: LocalDB;

  constructor() {
    const dir = dataDir();
    fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true });
    this.file = path.join(dir, 'db.json');
    try {
      this.db = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      this.db = { reports: [], alerts: [], resources: DEFAULT_RESOURCES.map((r) => ({ ...r })), snapshots: [], state: {} };
      this.save();
    }
  }
  private save() {
    fs.writeFileSync(this.file, JSON.stringify(this.db));
  }
  async getState<T>(key: string) {
    return (this.db.state[key] as T) ?? null;
  }
  async setState(key: string, value: unknown) {
    this.db.state[key] = value;
    this.save();
  }
  async listReports() {
    return [...this.db.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async addReport(r: Report) {
    this.db.reports.push(r);
    this.save();
  }
  async updateReport(id: string, patch: Partial<Report>) {
    const r = this.db.reports.find((x) => x.id === id);
    if (!r) return null;
    Object.assign(r, patch);
    this.save();
    return r;
  }
  async listAlerts(limit = 100) {
    return [...this.db.alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  async addAlert(a: Alert) {
    this.db.alerts.push(a);
    if (this.db.alerts.length > 500) this.db.alerts = this.db.alerts.slice(-500);
    this.save();
  }
  async listResources() {
    return this.db.resources;
  }
  async updateResource(id: string, patch: Partial<Resource>) {
    const r = this.db.resources.find((x) => x.id === id);
    if (!r) return null;
    Object.assign(r, patch);
    this.save();
    return r;
  }
  async listSnapshots(sinceIso: string) {
    return this.db.snapshots.filter((s) => s.at >= sinceIso);
  }
  async addSnapshots(s: Snapshot[]) {
    this.db.snapshots.push(...s);
    if (this.db.snapshots.length > MAX_SNAPSHOTS) this.db.snapshots = this.db.snapshots.slice(-MAX_SNAPSHOTS);
    this.save();
  }
  async savePhoto(id: string, buf: Buffer) {
    const name = `${id}.jpg`;
    fs.writeFileSync(path.join(dataDir(), 'uploads', name), buf);
    return `/api/uploads/${name}`;
  }
}

// ------------------------------------------------------------------ Supabase store
/* eslint-disable @typescript-eslint/no-explicit-any */
const toReport = (r: any): Report => ({
  id: r.id, hazard: r.hazard, description: r.description ?? '', lat: r.lat, lng: r.lng, zoneId: r.zone_id,
  zoneName: r.zone_name ?? '', photoUrl: r.photo_url, aiLabel: r.ai_label, aiConfidence: r.ai_confidence,
  aiMethod: r.ai_method, verificationScore: r.verification_score ?? 0, status: r.status, createdAt: r.created_at,
});
const fromReport = (r: Partial<Report>) => {
  const o: Record<string, unknown> = {};
  const map: Record<string, string> = {
    id: 'id', hazard: 'hazard', description: 'description', lat: 'lat', lng: 'lng', zoneId: 'zone_id', zoneName: 'zone_name',
    photoUrl: 'photo_url', aiLabel: 'ai_label', aiConfidence: 'ai_confidence', aiMethod: 'ai_method',
    verificationScore: 'verification_score', status: 'status', createdAt: 'created_at',
  };
  for (const [k, v] of Object.entries(r)) if (map[k]) o[map[k]] = v;
  return o;
};
const toAlert = (a: any): Alert => ({
  id: a.id, zoneId: a.zone_id, zoneName: a.zone_name, hazard: a.hazard, category: a.category,
  title: a.title, message: a.message, source: a.source, createdAt: a.created_at,
  audience: a.audience ?? 'all', reach: a.reach ?? null,
});
const toResource = (r: any): Resource => ({
  id: r.id, type: r.type, name: r.name, lat: r.lat, lng: r.lng, capacity: r.capacity, occupied: r.occupied, status: r.status, zoneId: r.zone_id,
});

class SupabaseStore implements Store {
  kind = 'supabase' as const;
  private sb: SupabaseClient;
  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: false } });
  }
  private check<T>(res: { data: T; error: { message: string } | null }) {
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
    return res.data;
  }
  async getState<T>(key: string) {
    const data = this.check(await this.sb.from('app_state').select('value').eq('key', key).maybeSingle());
    return ((data as any)?.value as T) ?? null;
  }
  async setState(key: string, value: unknown) {
    this.check(await this.sb.from('app_state').upsert({ key, value, updated_at: new Date().toISOString() }));
  }
  async listReports() {
    const data = this.check(await this.sb.from('reports').select('*').order('created_at', { ascending: false }).limit(300));
    return (data as any[]).map(toReport);
  }
  async addReport(r: Report) {
    this.check(await this.sb.from('reports').insert(fromReport(r)));
  }
  async updateReport(id: string, patch: Partial<Report>) {
    const data = this.check(await this.sb.from('reports').update(fromReport(patch)).eq('id', id).select().maybeSingle());
    return data ? toReport(data) : null;
  }
  async listAlerts(limit = 100) {
    const data = this.check(await this.sb.from('alerts').select('*').order('created_at', { ascending: false }).limit(limit));
    return (data as any[]).map(toAlert);
  }
  async addAlert(a: Alert) {
    this.check(
      await this.sb.from('alerts').insert({
        id: a.id, zone_id: a.zoneId, zone_name: a.zoneName, hazard: a.hazard, category: a.category,
        title: a.title, message: a.message, source: a.source, created_at: a.createdAt,
        audience: a.audience ?? 'all', reach: a.reach ?? null,
      }),
    );
  }
  async listResources() {
    const data = this.check(await this.sb.from('resources').select('*').order('id'));
    return (data as any[]).map(toResource);
  }
  async updateResource(id: string, patch: Partial<Resource>) {
    const row: Record<string, unknown> = {};
    if (patch.status) row.status = patch.status;
    if (patch.occupied !== undefined) row.occupied = patch.occupied;
    const data = this.check(await this.sb.from('resources').update(row).eq('id', id).select().maybeSingle());
    return data ? toResource(data) : null;
  }
  async listSnapshots(sinceIso: string) {
    const data = this.check(
      await this.sb.from('risk_snapshots').select('at, zone_id, overall, category').gte('at', sinceIso).order('at').limit(10000),
    );
    return (data as any[]).map((s) => ({ at: new Date(s.at).toISOString(), zoneId: s.zone_id, overall: s.overall, category: s.category }));
  }
  async addSnapshots(s: Snapshot[]) {
    this.check(await this.sb.from('risk_snapshots').insert(s.map((x) => ({ at: x.at, zone_id: x.zoneId, overall: x.overall, category: x.category }))));
  }
  async savePhoto(id: string, buf: Buffer, contentType: string) {
    const name = `${id}.jpg`;
    this.check(await this.sb.storage.from('report-photos').upload(name, buf, { contentType, upsert: true }));
    return this.sb.storage.from('report-photos').getPublicUrl(name).data.publicUrl;
  }
}

// ------------------------------------------------------------------ singleton
const g = globalThis as unknown as { __rqStore?: Store };

export function getStore(): Store {
  if (!g.__rqStore) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    g.__rqStore = url && key ? new SupabaseStore(url, key) : new LocalStore();
  }
  return g.__rqStore;
}
