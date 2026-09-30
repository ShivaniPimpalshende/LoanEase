"""
main.py — FastAPI application entry point
Run: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database import engine, Base
from routes.applications import router as app_router
from routes.notify import router as notify_router
from routes.auth import router as auth_router

load_dotenv()

# Create tables (idempotent — won't overwrite existing loan.db data)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Loan Pre-Screening API",
    description="Automated loan application pre-screening system",
    version="1.0.0",
)

# Allow all origins for local hackathon dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount routers ────────────────────────────────────────────────────────────
app.include_router(app_router,    prefix="/applications", tags=["Applications"])
app.include_router(notify_router, prefix="/applications", tags=["Notify"])
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "Loan Pre-Screening API is running"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}
