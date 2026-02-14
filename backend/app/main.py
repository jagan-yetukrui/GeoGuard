from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(router)
