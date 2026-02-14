# GeoGuard Backend

Python FastAPI backend for live earthquake data, risk zoning, and response plans.

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

## Environment

- `CORS_ORIGINS`: Comma-separated origins (default: `http://localhost:3000`)
- `USGS_CACHE_TTL_SECONDS`: Cache TTL for USGS feed (default: 30)

No secrets required for MVP.
