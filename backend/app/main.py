from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.database import engine
from app.routes import router

settings = get_settings()

app = FastAPI(title="Demobooru API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/api/health")
def health() -> JSONResponse:
    """Report service liveness and database connectivity."""
    try:
        with engine.connect() as connection:
            _ = connection.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - report any driver failure
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": f"unreachable: {exc}"},
        )
    return JSONResponse(content={"status": "ok", "database": "connected"})
