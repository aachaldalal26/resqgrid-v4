# ResQGrid — Architecture

## System overview

```mermaid
flowchart LR
  subgraph Sources["Data sources (free)"]
    OM["Open-Meteo Forecast<br/>rain · temp · gusts"]
    FL["Open-Meteo Flood API<br/>river discharge (GloFAS)"]
    EL["Open-Meteo Elevation"]
    OF["IMD / NDMA / CWC<br/>(mock adapter)"]
    CR["Citizen reports<br/>photo + GPS"]
  end

  subgraph Web["Next.js 14 app (web/)"]
    API["API routes<br/>/api/state · /api/reports · /api/alerts<br/>/api/route · /api/simulate · /api/refresh"]
    ENG["Risk engine<br/>engine.ts"]
    SIM["Simulation mode<br/>scenarios.ts"]
    RT["A* safe routing<br/>routing.ts"]
    RULES["Rule engine fallback<br/>risk.ts"]
    UI["Pages: Landing · Live Map · Report · Alerts<br/>Command Center (authority)"]
  end

  subgraph ML["AI service (ml-service/, Flask)"]
    PRED["/predict<br/>GradientBoosting x4 + explanations"]
    ANOM["/anomaly<br/>z-score + IsolationForest"]
    CLIP["/classify-report<br/>Hugging Face CLIP"]
  end

  subgraph DB["Store"]
    LOCAL["Local JSON<br/>(default)"]
    SUPA["Supabase<br/>Postgres+PostGIS · Storage · Realtime"]
  end

  OM & FL & EL --> ENG
  OF --> API
  CR --> API
  SIM --> ENG
  ENG -->|inputs| PRED & ANOM
  ENG -.offline.-> RULES
  API --> CLIP
  ENG --> API
  RT --> API
  API <--> LOCAL
  API <--> SUPA
  API --> UI
  SUPA -. realtime alerts .-> UI
```

## Request flow: one refresh of live risk

```mermaid
sequenceDiagram
  participant B as Browser (map / dashboard)
  participant A as /api/state
  participant E as Risk engine
  participant W as Open-Meteo (cached 10 min)
  participant M as Flask AI
  participant S as Store
  B->>A: GET every 3-4 s
  A->>E: getLiveState() (2.5 s cache)
  E->>W: weather for 35 cities (only if cache is stale)
  E->>S: sim state + verified reports
  E->>E: apply simulation scenario (if active)
  E->>M: POST /predict + /anomaly
  M-->>E: scores, category, factors, reason, anomaly
  E->>S: new alert if a zone escalated to High/Critical
  E->>S: risk snapshot every 15 s (history)
  E-->>B: zones + city stats + status
```

## Citizen report verification

```mermaid
flowchart TD
  P[Photo + hazard + GPS] --> U[Save photo: Storage / local]
  U --> C[CLIP zero-shot: flood / fire / landslide / storm / normal]
  C --> V{"Verification score =<br/>0.5 x image match<br/>+ 0.3 x nearby similar reports (1.5 km, 6 h)<br/>+ 0.2 x sensor risk for that hazard"}
  V -->|">= 0.6"| VER[Auto-verified → raises zone risk +5]
  V -->|"< 0.6"| PEN[Pending → authority triage board]
  PEN -->|Verify / Reject| VER
```

## Data model (Supabase)

```mermaid
erDiagram
  zones ||--o{ risk_snapshots : has
  zones ||--o{ alerts : targets
  zones ||--o{ reports : contains
  zones ||--o{ resources : hosts
  profiles }o--|| zones : home_zone
  zones { text id PK  text name  geography boundary  geography centroid  real dist_river_km  real slope_deg  bool flood_prone  int population }
  risk_snapshots { bigint id PK  timestamptz at  text zone_id FK  int overall  text category }
  alerts { uuid id PK  text zone_id FK  text hazard  text category  text title  text message  text source }
  reports { uuid id PK  text hazard  float lat  float lng  geography geom  text photo_url  text ai_label  real verification_score  text status }
  resources { text id PK  text type  text name  int capacity  int occupied  text status }
  profiles { uuid id PK  text role  text home_zone FK }
```

## Feature → file map

| Feature (from PPT) | Where |
|---|---|
| Localized risk prediction | `web/src/lib/weather.ts`, `engine.ts`, `ml-service/app.py /predict` |
| AI risk & anomaly detection | `ml-service/train.py`, `app.py /anomaly`, `web/src/lib/risk.ts` (fallback) |
| Real-time community alerts | `engine.ts processAlerts()`, `components/AlertToaster.tsx`, Supabase Realtime |
| Community reporting & feedback | `app/report/page.tsx`, `api/reports/route.ts`, `app.py /classify-report` |
| Authority response dashboard | `app/dashboard/page.tsx`, `components/dashboard/*` |
| Interactive risk map | `components/RiskMap.tsx`, `app/map/page.tsx`, `ZoneDetail.tsx` |
| Smart emergency routing | `lib/routing.ts`, `api/route/route.ts` |
| Multi-language alerts | `src/i18n/{en,hi,mr}.json`, `I18nProvider.tsx` |
| Demo / simulation mode | `lib/scenarios.ts`, `api/simulate/route.ts`, `SimulationControl.tsx` |
| Privacy (~100 m public locations) | `api/reports` GET, `reports_public` view in `schema.sql` |

## Command Center design

The authority dashboard is a dark "mission control" screen built to be read at a glance on a projector:

* **City Threat Index**: a half-dial gauge with a heartbeat line that beats faster as the worst-zone risk rises.
* **Zone Hive**: every city as a glowing hexagon, laid out north→south / west→east like a mini-map.
* **Risk Seismograph**: a heat strip of every zone over the last 2 hours, so you can see *when* each area escalated.
* **Zone Intel**: score ring, hazard radar, AI reasons, anomaly flag and a priority queue of High/Critical zones.
* **Citizen Report Triage**: a kanban board (Incoming / Verified / Rejected) with photo, AI label and verification score.
* **Live Event Feed, Resources** (click to change status), **Broadcast** composer with templates.
