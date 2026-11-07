-- =====================================================================
-- ResQGrid — Supabase schema (Postgres + PostGIS + RLS + Realtime + Storage)
-- Run this ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Then run seed.sql.
-- =====================================================================

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- zones
create table if not exists public.zones (
  id              text primary key,
  name            text not null,
  state           text not null,
  river           text,
  dist_river_km   real not null,
  slope_deg       real not null,
  flood_prone     boolean not null default false,
  relief_m        real not null,
  population      integer not null default 0,
  centroid        geography(Point, 4326) not null,
  boundary        geography(Polygon, 4326) not null
);
create index if not exists zones_boundary_gix on public.zones using gist (boundary);

-- ---------------------------------------------------------------- risk history
create table if not exists public.risk_snapshots (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  zone_id   text not null references public.zones(id) on delete cascade,
  overall   integer not null check (overall between 0 and 100),
  category  text not null check (category in ('Low','Moderate','High','Critical'))
);
create index if not exists risk_snapshots_at_idx on public.risk_snapshots (at desc);
create index if not exists risk_snapshots_zone_idx on public.risk_snapshots (zone_id, at desc);

-- ---------------------------------------------------------------- alerts
create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),
  zone_id     text references public.zones(id) on delete set null,
  zone_name   text not null,
  hazard      text not null,
  category    text not null check (category in ('Low','Moderate','High','Critical')),
  title       text not null,
  message     text not null,
  source      text not null check (source in ('auto','authority')),
  audience    text not null default 'all',
  reach       jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists alerts_created_idx on public.alerts (created_at desc);

-- ---------------------------------------------------------------- citizen reports
create table if not exists public.reports (
  id                  uuid primary key default gen_random_uuid(),
  hazard              text not null check (hazard in ('flood','landslide','heatwave','storm','fire','other')),
  description         text not null default '',
  lat                 double precision not null,
  lng                 double precision not null,
  geom                geography(Point, 4326),
  zone_id             text references public.zones(id) on delete set null,
  zone_name           text,
  photo_url           text,
  ai_label            text,
  ai_confidence       real,
  ai_method           text,
  verification_score  real not null default 0,
  status              text not null default 'pending' check (status in ('pending','verified','rejected')),
  created_at          timestamptz not null default now()
);
create index if not exists reports_geom_gix on public.reports using gist (geom);
create index if not exists reports_created_idx on public.reports (created_at desc);

-- keep the PostGIS point in sync with lat/lng
create or replace function public.reports_set_geom() returns trigger language plpgsql as $$
begin
  new.geom := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  return new;
end $$;
drop trigger if exists reports_geom_trg on public.reports;
create trigger reports_geom_trg before insert or update of lat, lng on public.reports
  for each row execute function public.reports_set_geom();

-- Privacy: public view with coordinates rounded to ~100 m, rejected reports hidden
create or replace view public.reports_public as
  select id, hazard, description, round(lat::numeric, 3)::double precision as lat, round(lng::numeric, 3)::double precision as lng,
         zone_id, zone_name, photo_url, ai_label, ai_confidence, verification_score, status, created_at
  from public.reports where status <> 'rejected';

-- ---------------------------------------------------------------- resources
create table if not exists public.resources (
  id        text primary key,
  type      text not null check (type in ('shelter','hospital','rescue')),
  name      text not null,
  lat       double precision not null,
  lng       double precision not null,
  capacity  integer not null default 0,
  occupied  integer not null default 0,
  status    text not null default 'available' check (status in ('available','busy','full','deployed')),
  zone_id   text references public.zones(id) on delete set null
);

-- ---------------------------------------------------------------- profiles (roles)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'citizen' check (role in ('citizen','authority')),
  home_zone   text references public.zones(id),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- app state (sim mode, caches)
create table if not exists public.app_state (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- helper functions
create or replace function public.is_authority() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'authority');
$$;

-- Which zone contains a point? (PostGIS)
create or replace function public.zone_for_point(p_lat double precision, p_lng double precision)
returns text language sql stable as $$
  select id from public.zones
  where st_covers(boundary, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  limit 1;
$$;

-- ---------------------------------------------------------------- Row Level Security
alter table public.zones          enable row level security;
alter table public.risk_snapshots enable row level security;
alter table public.alerts         enable row level security;
alter table public.reports        enable row level security;
alter table public.resources      enable row level security;
alter table public.profiles       enable row level security;
alter table public.app_state      enable row level security;

-- Public (anon) read access for map data and alerts
drop policy if exists "zones readable" on public.zones;
create policy "zones readable" on public.zones for select using (true);
drop policy if exists "snapshots readable" on public.risk_snapshots;
create policy "snapshots readable" on public.risk_snapshots for select using (true);
drop policy if exists "alerts readable" on public.alerts;
create policy "alerts readable" on public.alerts for select using (true);
drop policy if exists "resources readable" on public.resources;
create policy "resources readable" on public.resources for select using (true);

-- Reports: anyone signed in may submit; only authorities read exact rows / triage
drop policy if exists "reports insert" on public.reports;
create policy "reports insert" on public.reports for insert to authenticated with check (true);
drop policy if exists "reports authority read" on public.reports;
create policy "reports authority read" on public.reports for select using (public.is_authority());
drop policy if exists "reports authority update" on public.reports;
create policy "reports authority update" on public.reports for update using (public.is_authority());

-- Authorities manage alerts and resources
drop policy if exists "alerts authority insert" on public.alerts;
create policy "alerts authority insert" on public.alerts for insert with check (public.is_authority());
drop policy if exists "resources authority update" on public.resources;
create policy "resources authority update" on public.resources for update using (public.is_authority());

-- Profiles: users see/edit their own
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select using (auth.uid() = id or public.is_authority());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (auth.uid() = id) with check (role = (select role from public.profiles where id = auth.uid()));

-- app_state: no public policies (only the server's service-role key can use it)

-- Public may read the privacy-safe view
grant select on public.reports_public to anon, authenticated;

-- Create a profile automatically for every new auth user
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- Realtime (live alerts)
do $$ begin
  alter publication supabase_realtime add table public.alerts;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ---------------------------------------------------------------- Storage bucket for report photos
insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;
