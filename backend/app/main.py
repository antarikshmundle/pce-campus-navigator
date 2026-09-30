from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import engine
from app.models.usage_event import UsageEvent
from app.routers import admin_insights, admin_stats, auth, chat, events, locations


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Stage 11: the anonymous usage_events table is new and separate. Create
    # it if missing (never alters or drops anything existing).
    UsageEvent.__table__.create(bind=engine, checkfirst=True)
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(locations.router, prefix=settings.API_V1_PREFIX)
app.include_router(chat.router, prefix=settings.API_V1_PREFIX)
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin_stats.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin_insights.router, prefix=settings.API_V1_PREFIX)
app.include_router(events.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME}
