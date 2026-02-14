# GeoGuard

Real-time earthquake response intelligence: live USGS data, risk zoning with plate context, and response plans.

## Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind, Leaflet + OpenStreetMap
- **Backend**: Python 3.11, FastAPI, USGS feed, Shapely (plate boundaries), zoning heuristics

## Run locally

**Backend** (port 8000):

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend** (port 3000):

```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` in `.env.local` if needed (default is 8000).

## Repo

[https://github.com/jagan-yetukrui/GeoGuard](https://github.com/jagan-yetukrui/GeoGuard)
