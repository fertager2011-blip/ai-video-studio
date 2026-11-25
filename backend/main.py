import os
import re
import json
import uuid
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

APP_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("AIVS_DATA_DIR", str(APP_DIR / "data"))).resolve()
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "projects.sqlite3"
MAX_UPLOAD_BYTES = int(os.getenv("AIVS_MAX_UPLOAD_MB", "500")) * 1024 * 1024
API_TOKEN = os.getenv("AIVS_API_TOKEN", "").strip()
ALLOWED_ORIGINS = [
    item.strip() for item in os.getenv(
        "AIVS_ALLOWED_ORIGINS",
        "https://fertager2011-blip.github.io"
    ).split(",") if item.strip()
]
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm"}
ALLOWED_CONTENT_TYPES = {
    "video/mp4", "video/quicktime", "video/x-m4v",
    "video/webm", "application/octet-stream"
}

app = FastAPI(
    title="AI Video Studio API",
    version="0.1.0",
    description="Project and source-video intake API. AI processing is not enabled yet."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def connect_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with connect_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                instruction TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                content_type TEXT,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                plan_note TEXT,
                style_note TEXT
            )
        """)
        conn.commit()


@app.on_event("startup")
def startup():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    init_db()


def require_token(authorization: Optional[str] = Header(default=None)):
    if not API_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Server is not configured: AIVS_API_TOKEN is missing."
        )
    expected = f"Bearer {API_TOKEN}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API token.")
    return True


def project_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "instruction": row["instruction"],
        "original_filename": row["original_filename"],
        "file_size": row["file_size"],
        "content_type": row["content_type"],
        "status": row["status"],
        "created_at": row["created_at"],
        "plan_note": row["plan_note"],
        "style_note": row["style_note"],
        "processing_enabled": False
    }


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "AI Video Studio API",
        "version": "0.1.0",
        "processing_enabled": False
    }


@app.get("/api/v1/projects")
def list_projects(_: bool = Depends(require_token)):
    with connect_db() as conn:
        rows = conn.execute(
            "SELECT * FROM projects ORDER BY created_at DESC"
        ).fetchall()
    return {"projects": [project_dict(row) for row in rows]}


@app.get("/api/v1/projects/{project_id}")
def get_project(project_id: str, _: bool = Depends(require_token)):
    with connect_db() as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project_dict(row)


@app.post("/api/v1/projects", status_code=201)
async def create_project(
    instruction: str = Form(...),
    video: UploadFile = File(...),
    _: bool = Depends(require_token)
):
    instruction = instruction.strip()
    if not instruction:
        raise HTTPException(status_code=422, detail="Instruction cannot be empty.")

    original_name = Path(video.filename or "video").name
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Unsupported video extension. Allowed: mp4, mov, m4v, webm."
        )
    if video.content_type and video.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported video content type.")

    project_id = str(uuid.uuid4())
    stored_name = f"{project_id}{extension}"
    destination = UPLOAD_DIR / stored_name
    total = 0

    try:
        with destination.open("wb") as output:
            while True:
                chunk = await video.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Video exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit."
                    )
                output.write(chunk)

        if total == 0:
            raise HTTPException(status_code=400, detail="Uploaded video is empty.")

        created_at = datetime.now(timezone.utc).isoformat()
        name = Path(original_name).stem[:120] or "Новый проект"
        with connect_db() as conn:
            conn.execute("""
                INSERT INTO projects (
                    id, name, instruction, original_filename, stored_filename,
                    file_size, content_type, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                project_id, name, instruction, original_name, stored_name,
                total, video.content_type, "Загружено · ожидает анализа",
                created_at
            ))
            conn.commit()

        return {
            "id": project_id,
            "name": name,
            "status": "Загружено · ожидает анализа",
            "file_size": total,
            "created_at": created_at,
            "processing_enabled": False,
            "message": "Видео сохранено. AI processing is not enabled yet."
        }
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await video.close()


@app.get("/")
def root():
    return JSONResponse({
        "service": "AI Video Studio API",
        "health": "/health",
        "api_version": "v1"
    })
