from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.communications_routes import router as communications_router
from app.patriot_routes import router as patriot_router
from app.resource_routes import router as resource_router
from app.routes import router
from app.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Preload plate boundaries and historical quakes at startup
    from app.plates import _load_boundaries
    from app.historical import get_historical_quakes
    _load_boundaries()
    get_historical_quakes()
    yield
    # shutdown if needed
    pass


app = FastAPI(title="GeoGuard API", lifespan=lifespan)

# Parse CORS origins (strip spaces); ensure localhost:3000 and 127.0.0.1:3000 for dev
_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if "http://127.0.0.1:3000" not in _cors_origins and "http://localhost:3000" in _cors_origins:
    _cors_origins.append("http://127.0.0.1:3000")
if not _cors_origins:
    _cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(router)
app.include_router(patriot_router, prefix="/api")
app.include_router(resource_router, prefix="/api")
app.include_router(communications_router, prefix="/api")