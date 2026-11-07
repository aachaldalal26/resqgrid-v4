# ResQGrid — 5-minute demo script for judges

**Before you start (10 min earlier)**
- Start the AI service (`start-ml.bat`) and the web app (`start-web.bat`).
- Open 3 browser tabs: `localhost:3000` (landing), `localhost:3000/map`, `localhost:3000/dashboard` (already logged in with `resq2026`).
- On the map tab, allow notifications on `/alerts` ("Enable notifications").
- Make sure no simulation is running (click "Back to live").
- Keep a flood photo on your phone or laptop for the report step.

| Time | Who | Show | Say |
|---|---|---|---|
| 0:00 – 0:30 | Leader | Landing page | "India faces floods, cyclones, heatwaves and landslides every year, but warnings often come for a whole state or district. ResQGrid predicts risk **city by city across India**, and tells people exactly what to do." |
| 0:30 – 1:15 | Member 1 | `/map` (whole India), click **Mumbai** | "Each zone gets a 0–100 score from live Open-Meteo rain, river discharge, terrain and slope. Our AI model explains *why* — here are the top factors — plus a 24-hour forecast and safety steps." Switch language to **मराठी** → "Alerts and tips in English, Hindi and Marathi." |
| 1:15 – 2:30 | Member 2 | Click **🌊 Monsoon floods – Mumbai, Kerala, Assam & Bihar** | "This is demo mode: we inject a real-world monsoon scenario." Wait ~20 s: "Watch — Mumbai, Kochi, Guwahati and Patna turn orange then red, the **AI flags a rainfall anomaly**, and alerts fire automatically" (toast appears). Click **Safe route to nearest shelter**: "The route avoids the red zones, and if risk changes it re-plans by itself." |
| 2:30 – 3:15 | Member 3 | `/report` | Choose Flood, add the photo, zoom into Mumbai and tap a spot on the map, submit. "The image AI checks the photo, then we combine it with nearby reports and sensor risk into a **verification score**. Verified reports raise the zone's risk — the community becomes a sensor network." |
| 3:15 – 4:30 | Leader | `/dashboard` | "This is the **Command Center** for PMC / disaster cell. City Threat Index with a live heartbeat; the hive shows every zone at a glance; the **seismograph** shows exactly when each area escalated. The citizen report just arrived in the triage board → **Verify**. Resources nearest the zone are listed → mark the rescue boat **deployed**. Then **Broadcast**: pick Mumbai, 'Evacuate' template, send." Optional: click **Back to live**, then **🌀 Cyclone** to show Odisha going red with storm risk." Switch to the map tab to show the alert arrived. |
| 4:15 – 4:30 | Member 4 | `/prepare`, then `/subscribe?group=schools` | "Citizens learn, practise drills and track a preparedness score; schools and vulnerable people subscribe for targeted alerts by SMS, WhatsApp or email." |
| 4:30 – 5:00 | Member 4 | Back to slide / dashboard | "Free data sources, an open-source stack and an offline fallback mean any city can deploy ResQGrid. Next: IoT river sensors, real IMD/CWC feeds, SMS/WhatsApp alerts and drone imagery. **Predict the risk. Alert the community. Act before disaster.**" Click **Back to live**. |

---

## Likely judge questions & answers

**Q1. Where does your training data come from? Is the model real?**
Labelled city-level disaster-risk data for India isn't publicly available. So we wrote a documented generator (`generate_dataset.py`) that creates 32,000 realistic weather/terrain samples across six regimes and labels them with expert hazard formulas plus noise. The GradientBoosting models reach R² 0.97–0.99 on held-out data. The pipeline is ready for real data: replace the CSV with historical IMD rainfall, CWC levels and NDMA / state disaster records, then rerun `train.py`.

**Q2. Is the weather data live?**
Yes. Open-Meteo's forecast, flood (river discharge from GloFAS) and elevation APIs are called for all 35 cities and cached for 10 minutes. If they fail, we keep the last good data and show "Data may be delayed". Demo mode exists only because we can't schedule a real flood for the judging slot.

**Q3. How is this better than IMD alerts?**
IMD warns at district level. We downscale to locality level, combine terrain and river proximity, explain the reason in plain language, give specific actions in three languages, route people to shelters, and close the loop with citizen reports and authority actions.

**Q4. How do you stop fake citizen reports?**
Three-way verification: image AI (does the photo show what's claimed?), corroboration (similar reports within 1.5 km in 6 hours), and sensor agreement (does the predicted risk support it?). Only reports scoring 60%+ auto-verify; the rest go to human triage. Public locations are rounded to ~100 m for privacy.

**Q5. What if the internet or your AI server goes down?**
The web app has a rule engine with the same formulas as the AI, so it keeps scoring. Weather falls back to the last snapshot. Supabase Realtime plus 5-second polling deliver alerts. For future low-connectivity areas we plan SMS / cell broadcast.

**Q6. How does safe routing work?**
An A* search on a ~220 m grid where every cell takes its zone's risk: Critical is blocked, High costs 8×, Moderate 1.5×. It picks the nearest shelter that isn't full or in a danger zone, and re-plans whenever risk changes. In production we'd pass these avoid-areas to OSRM or Google Directions for turn-by-turn navigation.

**Q7. Can it scale?**
It already covers 35 cities across India. Adding a city is one line in `zones.json` (or a PostGIS polygon) plus its shelters. Open-Meteo works worldwide, and the model uses physical features, not city-specific ones. Next step: district-level and ward-level zones inside each city.

**Q8. What's the cost?**
Development and demo run at ₹0: Open-Meteo, OpenStreetMap, Supabase free tier, Vercel / Render free tiers. A city deployment needs a small cloud server and an SMS gateway.

**Q9. Privacy?**
Authorities see exact report locations; the public sees ~100 m rounding. Row Level Security in Supabase restricts raw reports to authority accounts. Secrets live only in environment variables.

**Q10. What's next?**
IoT rain/river sensors (ESP32 + ultrasonic), real IMD/CWC CAP feeds, district and ward boundaries, SMS/WhatsApp alerts, drone imagery for damage assessment, and retraining on India's historical disaster records (EM-DAT, IMD, CWC).
