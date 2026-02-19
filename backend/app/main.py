from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.routes import auth_routes, categories, habits, health, tasks


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="dodo-api", version="0.1.0")

    origins = ["*"] if settings.cors_origin == "*" else [settings.cors_origin]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def root():
        return {"name": "dodo-api", "version": "0.1.0"}

    app.include_router(auth_routes.router, prefix="/api")
    app.include_router(health.router, prefix="/api/health")
    app.include_router(tasks.router, prefix="/api")
    app.include_router(categories.router, prefix="/api")
    app.include_router(habits.router, prefix="/api")

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=400, content={"error": "Invalid request payload."})

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(_request: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

    @app.exception_handler(Exception)
    async def global_exception_handler(_request: Request, exc: Exception):
        return JSONResponse(status_code=500, content={"error": str(exc)})

    return app


app = create_app()
