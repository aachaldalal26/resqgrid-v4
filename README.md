# ResQGrid — Community-Level Disaster Early Warning & Action System

**Predict the Risk. Alert the Community. Act Before Disaster.**
Team **TerraPulse** · I²IT Pune · PCCOE International Grand Challenge 2026
Domain: Disaster Resilience, Public Health & Community Well-being

ResQGrid is an all-India web platform. It combines live rainfall, river discharge, terrain, official advisories and citizen reports. From these it predicts flood, landslide, heatwave and storm risk for **35 disaster-prone cities and districts across India**, from Mumbai, Kolkata and Delhi to Guwahati, Wayanad, Puri and Shimla. When risk rises it pushes alerts with clear safety steps in **English, Hindi and Marathi**, plans **safe routes to shelters** that avoid danger zones, and gives authorities a **Command Center** dashboard.

---

## What's inside

```
resqgrid/
├── ml-service/            Python AI service (Flask)
│   ├── app.py             /health  /predict  /anomaly  /classify-report
│   ├── risk_formulas.py   expert hazard formulas (shared "ground truth")
│   ├── generate_dataset.py  synthetic training data generator (documented)
│   ├── train.py           trains 4 GradientBoosting models + IsolationForest
│   ├── models/            trained models (ready to use) + metrics.json
│   ├── requirements.txt   core packages
│   └── requirements-ai.txt  optional CLIP image AI (transformers + torch)
├── web/                   Next.js 14 app (frontend + API routes)
│   ├── src/app/           pages: / map report alerts login dashboard + api/*
│   ├── src/components/    map, zone panel, simulation control, dashboard widgets
│   ├── src/lib/           risk engine, weather, routing (A*), store, auth
│   ├── src/data/          35 India zones, relief camps, hospitals, NDRF teams, official feed
│   └── src/i18n/          en.json  hi.json  mr.json
├── supabase/              schema.sql (PostGIS + RLS + Realtime + Storage), seed.sql
├── scripts/make_seed.py   regenerates seed.sql from the app's data files
├── docs/ARCHITECTURE.md   Mermaid diagrams + how each feature works
├── docs/DEMO_SCRIPT.md    5-minute judge demo + likely questions & answers
├── start-ml.bat           Windows: start the AI service
└── start-web.bat          Windows: start the web app
```

**Two run modes**

| Mode | Setup | Data stored in |
|---|---|---|
| **Local (default)** | none — works out of the box | `web/.data/db.json` + `web/.data/uploads/` |
| **Supabase** | fill 4 env vars | Supabase Postgres + PostGIS, Storage, Realtime |

The app keeps working even if pieces fail. If the AI service is off, a rule engine using the **same formulas** takes over. If the weather API is down, the last good data is kept and a **"Data may be delayed"** chip appears.

---

## Quick start on Windows (step by step)

### 1. Install the tools (one time)

1. **Node.js 20 LTS** — https://nodejs.org → download "LTS" → install (keep defaults).
2. **Python 3.11 or 3.12** — https://www.python.org/downloads/ → during install **tick "Add python.exe to PATH"**.
3. Optional: **VS Code** — https://code.visualstudio.com

Open **Command Prompt** and check:

```bat
node -v
npm -v
python --version
```

### 2. Unzip the project

Unzip `ResQGrid.zip` to e.g. `C:\Projects\resqgrid`.

### 3. Start the AI service (terminal 1)

```bat
cd C:\Projects\resqgrid\ml-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

You should see `Running on http://127.0.0.1:5000`. Open http://127.0.0.1:5000/health — it shows the model accuracy.
(Next time just double-click **`start-ml.bat`**.)

> The trained model is already in `models/`. To retrain: `python generate_dataset.py` then `python train.py`.
> If you see a scikit-learn version warning, the service retrains itself automatically (takes ~20 s).

### 4. Start the web app (terminal 2)

```bat
cd C:\Projects\resqgrid\web
copy .env.example .env.local
npm install
npm run dev
```

Open **http://localhost:3000** 🎉 (Next time just double-click **`start-web.bat`**.)

### 5. Try it

| Page | URL | What to do |
|---|---|---|
| Landing | `/` | live top-risk zones, stats |
| Search anywhere | home page & `/map` | type any **village, town, district or state** in India (or tap *Use my location*) → live AI risk for that exact spot, nearest hospitals / relief camps / NDRF |
| Live map | `/map` | click a zone → score, *why*, forecast, safety tips · "Safe route to nearest shelter" |
| Report | `/report` | pick hazard, add a photo, tap the map → AI check + verification score |
| Alerts | `/alerts` | live alerts, official advisories, community reports · enable notifications |
| Command Center | `/dashboard` | log in at `/login` with access code **`resq2026`** (change it in `.env.local`) |
| Prepare | `/prepare` | learn (before/during/after), practice scenario drills, emergency kit, preparedness score, helplines |
| Get alerts | `/subscribe` | residents, schools & colleges, vulnerable communities, responders, NGOs · push / SMS / WhatsApp / email |
| Open API | `/developers` | live JSON API for NGOs and agencies + IoT sensor ingestion |

## PPT feature checklist

| In the PPT | Where in the app |
|---|---|
| Localized risk prediction (weather, rainfall, water levels, terrain, history, official alerts) | `/map`, risk engine + AI model |
| AI-based risk & anomaly detection (Low / Moderate / High / Critical) | AI service `/predict`, `/anomaly`; shown on map & dashboard |
| Real-time community alerts + safety recommendations | toasts, browser notifications, `/alerts`, Supabase Realtime |
| Community reporting & feedback, AI report verification | `/report`, CLIP photo check, verification score |
| Authority response dashboard | `/dashboard` Command Center |
| Interactive risk map | `/map`, home page live India map |
| Stakeholders: citizens, authorities, schools & colleges, emergency teams, vulnerable communities, NGOs | home stakeholder switcher, `/subscribe` groups, targeted broadcasts |
| Learn from experts → Practice scenarios → Track progress | `/prepare` |
| Multi-hazard (floods, landslides, heatwaves, storms/cyclones) | 4 hazards + 4 India drills |
| IoT integration (rain, water level, temperature sensors) | IoT Sensor Grid on dashboard, `POST /api/sensors` |
| Satellite monitoring | satellite map layer (map + dashboard) |
| Multi-language alerts | English · हिंदी · मराठी |
| Alerts by SMS, app, email, push | `/subscribe` channels, reach counted per channel (SMS/email gateway = plug-in) |
| Smart emergency routing | safe route to nearest relief camp |
| Resource allocation & coordination | resource board, priority queue, broadcast |
| APIs for external systems / data sharing | `/developers` |
| Privacy (secure storage, location privacy) | ~100 m public rounding, RLS, contacts never exposed |
| Weak internet / API failures | offline banner + last saved data on device, "data may be delayed", rule-engine fallback |
| Drone monitoring | future scope (satellite layer + photo reports today) |

**Demo mode:** on the map or Command Center, pick a scenario: **🌊 Monsoon floods** (Mumbai, Kerala, Assam, Bihar), **🌀 Cyclone** (Odisha & Andhra coast), **🔥 Heatwave** (North & Central India) or **⛰️ Landslides** (Himalayas & Western Ghats). Over 45 seconds the risk ramps up, cities turn red, alerts fire, anomalies are flagged and safe routes re-plan. Click **Back to live** to reset.

---

## Optional: real image AI (CLIP)

Without it, photo checks use a simple colour heuristic (low confidence, clearly labelled `colour-heuristic`). For real zero-shot classification with Hugging Face CLIP:

```bat
cd ml-service
venv\Scripts\activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install transformers
python app.py
```

The first photo takes 30–60 s while the model (~600 MB) downloads. After that it's fast.

---

## Optional: Supabase (cloud database, realtime, storage)

1. Create a free project at https://supabase.com.
2. **SQL Editor → New query** → paste `supabase/schema.sql` → **Run**. Then paste `supabase/seed.sql` → **Run**.
3. **Project Settings → API**: copy the *Project URL*, the *anon public* key and the *service_role* key.
4. In `web/.env.local` set:
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...   (secret! server only)
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
5. Restart `npm run dev`. Reports, alerts, history and photos now live in Supabase. New alerts are pushed instantly through **Supabase Realtime**.

The schema includes PostGIS zone polygons, `zone_for_point(lat, lng)`, a privacy view `reports_public` (coordinates rounded to ~100 m), RLS policies, a `profiles` table with `citizen`/`authority` roles, and the `report-photos` storage bucket.

---

## Deployment

**AI service → Render**
1. Push the repo to GitHub.
2. Render → New → **Web Service** → pick the repo → Root directory `ml-service`.
3. Build: `pip install -r requirements.txt` · Start: `gunicorn app:app --bind 0.0.0.0:$PORT --timeout 120`.
4. Copy the URL (e.g. `https://resqgrid-ml.onrender.com`).

**Web app → Vercel**
1. Vercel → New Project → import the repo → Root directory `web`.
2. Environment variables: `ML_SERVICE_URL` (Render URL), `AUTHORITY_CODE`, `AUTH_SECRET`, `CRON_SECRET`, and the 4 Supabase vars (**required on Vercel**, because its disk is temporary).
3. Deploy. `vercel.json` schedules `/api/refresh` every 10 minutes. On the free Hobby plan Vercel only allows daily crons. In that case use a free service like cron-job.org to call `https://your-app.vercel.app/api/refresh?key=CRON_SECRET` every 10 minutes. The app also refreshes by itself whenever someone has it open.

> Free Render services sleep after inactivity. Open `/health` a minute before your demo.

---

## How the risk score works (short)

For each city the app gathers: rain in the last 24 h, the 24 h forecast, the heaviest hourly burst, river discharge versus normal, max temperature, max wind gust, elevation, distance to river, slope, and whether the area is historically flood-prone.

* **AI model:** 4 GradientBoosting regressors (one per hazard), trained on 32,000 synthetic samples across six weather regimes (incl. dam-release floods with no local rain), R² ≈ 0.97–0.99. The data is generated from documented expert formulas plus noise (`generate_dataset.py`), because labelled city-level disaster data for India isn't public. Swap in real labelled history and retrain with the same scripts.
* **Explanation:** each feature is reset to a "calm" value and the score drop is measured. The biggest drops become the plain-language reason, e.g. *"Heavy rain forecast (170 mm next 24h) + River discharge 5.5x normal + Historically flood-prone area"*.
* **Overall** = worst hazard + 10 % of the second worst + verified citizen reports (+5 each, max 15) + official advisory level (+2 per level) + IoT river sensor alarm (+8 warning, +16 danger).
  **Low** < 30 ≤ **Moderate** < 55 ≤ **High** < 75 ≤ **Critical**.
* **Anomalies:** a rolling z-score on hourly rain catches sudden spikes; a river surge above 2.5× normal is flagged; an IsolationForest flags unusual rain/river/wind combinations.

## Known limits (be honest with judges)

* Each city is a 25 km hexagon around its real centre, not an official district boundary. Swap in district GeoJSON (or add more cities in `web/src/data/zones.json`) for production.
* The official IMD/NDMA/CWC feed is a **mock adapter** (`/api/official-alerts`) with the right shape, ready to connect.
* Safe routes avoid danger zones on a 220 m grid, but they are not snapped to roads. Production would pass these avoid-areas to OSRM or Google Directions.
* Login is a signed-cookie demo login with an access code. The `profiles` table and RLS are ready for Supabase Auth.
* Populations, relief-camp locations/capacities and hospital/NDRF positions are approximate demo data.

## Troubleshooting

| Problem | Fix |
|---|---|
| `python` not found | Reinstall Python with "Add to PATH" ticked, or use `py` instead of `python` |
| `npm install` fails | Check your internet; delete `node_modules` and `package-lock.json`, then retry |
| Status chip says "Rule engine (AI offline)" | Start the AI service (`start-ml.bat`) |
| "Data may be delayed" | No internet / Open-Meteo unreachable. The app uses the last data; demo mode still works |
| Map is grey | Map tiles need internet |
| Port 3000 busy | `npm run dev -- -p 3001` |
| Reset all demo data | Stop the app and delete `web/.data` |

Credits: weather © Open-Meteo (CC BY 4.0) · maps © OpenStreetMap contributors, Esri World Imagery · icons Lucide.
