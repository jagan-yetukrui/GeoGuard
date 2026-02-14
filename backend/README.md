# GeoGuard Backend

Python FastAPI backend for live earthquake data, risk zoning, and response plans.

## Data sources

- **Earthquakes:** USGS only. Real-time feed ([earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson)) for live quake and latest-earthquakes list; FDSNWS Event API for event-by-id and optional historical window. NASA Earthdata references USGS for earthquake data; this app uses USGS directly.
- **Plate boundaries:** PB2002 (Bird 2003), same source as the USGS plate boundary map ([map_plateboundaries](https://earthquake.usgs.gov/arcgis/rest/services/eq/map_plateboundaries/MapServer)). Loaded from a configured URL (e.g. PB2002 GeoJSON) or fallback to local `data/plate_boundaries.geojson`.
- **Plate motion:** MORVEL-style proxy (values consistent with DeMets et al. 2010). For point-wise velocity use [UNAVCO Plate Motion Calculator](https://www.unavco.org/software/geodetic-utilities/plate-motion-calculator/plate-motion-calculator.html) or similar.

## Local run

From the `backend/` directory:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API: http://localhost:8000  
Docs: http://localhost:8000/docs

## Docker

```bash
docker build -t geoguard-backend .
docker run -p 8000:8000 geoguard-backend
```

## Plate boundaries

Risk zoning uses distance to the nearest plate boundary. If `PLATE_BOUNDARIES_URL` is set (e.g. `https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json`), boundaries are fetched from that URL at startup; otherwise the app loads `data/plate_boundaries.geojson`. The repo includes a minimal sample; use the URL or replace with full PB2002 for production.

## Environment

- `CORS_ORIGINS`: Comma-separated origins (default: `http://localhost:3000`)
- `USGS_CACHE_TTL_SECONDS`: Cache TTL for USGS feed (default: 30)
- `USGS_HISTORICAL_DAYS`: Optional; if set, fetch last N days M4+ from USGS FDSNWS for similar-quakes (merged with xlsx if present)
- `HISTORICAL_QUAKES_PATH`: Optional path to `earthquake_2025.xlsx`; default is project root
- `PLATE_BOUNDARIES_URL`: Optional URL for PB2002 GeoJSON; if unset, use local `data/plate_boundaries.geojson`
- `GEMINI_API_KEY`: Optional; required for POST /api/brief (AI summary) and POST /api/chat (911-style disaster chatbot)
- `ELEVENLABS_API_KEY`: Optional; required for POST /api/voice (text-to-speech)

No secrets required for core plan generation. Brief and voice endpoints return 503 if keys are missing.

## DigitalOcean (or any host) deploy

1. Build from repo root so backend and data are available:
   ```bash
   cd /path/to/GeoGuard
   docker build -f backend/Dockerfile -t geoguard-backend .
   ```
   To include historical quakes, ensure `earthquake_2025.xlsx` is in the build context and add to Dockerfile: `COPY earthquake_2025.xlsx .` (then set `HISTORICAL_QUAKES_PATH=/app/earthquake_2025.xlsx`).

2. Run:
   ```bash
   docker run -p 8000:8000 \
     -e CORS_ORIGINS=https://your-frontend.vercel.app \
     -e GEMINI_API_KEY=optional \
     -e ELEVENLABS_API_KEY=optional \
     geoguard-backend
   ```

3. CORS must include your frontend origin. Backend listens on `0.0.0.0:8000`.
