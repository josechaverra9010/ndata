"""Fotos de progreso corporal del paciente + comparación A/B."""
from __future__ import annotations

import os
import uuid
from typing import Callable, List, Optional

from fastapi import Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import Session

ProgressPhotoDB = None

PHOTO_ANGLES = ("front", "side", "back", "other")
ANGLE_LABELS = {
    "front": "Frente",
    "side": "Perfil",
    "back": "Espalda",
    "other": "Otra",
}


def register_progress_photo_model(Base):
    global ProgressPhotoDB

    class _ProgressPhotoDB(Base):
        __tablename__ = "progress_photos"
        id = Column(Integer, primary_key=True, index=True)
        patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        metric_id = Column(Integer, ForeignKey("progress_metrics.id"), nullable=True, index=True)
        date = Column(String(20), nullable=False, index=True)
        angle = Column(String(20), default="front")
        photo_url = Column(String(500), nullable=False)
        caption = Column(Text, nullable=True)
        created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
        created_at = Column(String(50), nullable=True)

    ProgressPhotoDB = _ProgressPhotoDB
    return ProgressPhotoDB


def ensure_progress_photos_schema(engine, inspect_fn, text_fn):
    try:
        insp = inspect_fn(engine)
        tables = insp.get_table_names()
        if "progress_photos" in tables:
            return
        dialect = engine.dialect.name
        if dialect == "sqlite":
            ddl = """
            CREATE TABLE IF NOT EXISTS progress_photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                metric_id INTEGER,
                date VARCHAR(20) NOT NULL,
                angle VARCHAR(20) DEFAULT 'front',
                photo_url VARCHAR(500) NOT NULL,
                caption TEXT,
                created_by INTEGER,
                created_at VARCHAR(50)
            )
            """
        else:
            ddl = """
            CREATE TABLE IF NOT EXISTS progress_photos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_id INT NOT NULL,
                metric_id INT NULL,
                date VARCHAR(20) NOT NULL,
                angle VARCHAR(20) DEFAULT 'front',
                photo_url VARCHAR(500) NOT NULL,
                caption TEXT NULL,
                created_by INT NULL,
                created_at VARCHAR(50) NULL,
                INDEX ix_progress_photos_patient (patient_id),
                INDEX ix_progress_photos_date (date)
            )
            """
        with engine.begin() as conn:
            conn.execute(text_fn(ddl))
        print("[PROGRESS_PHOTOS] tabla progress_photos creada")
    except Exception as e:
        print(f"[PROGRESS_PHOTOS] schema: {e}")


def register_progress_photo_routes(app, deps: dict):
    get_db = deps["get_db"]
    get_current_user = deps["get_current_user"]
    authorize_patient_access = deps["authorize_patient_access"]
    UserDB = deps["UserDB"]
    ProgressMetricDB = deps.get("ProgressMetricDB")
    UPLOAD_DIR = deps["UPLOAD_DIR"]
    sanitize_filename = deps.get("sanitize_filename")
    validate_upload_file = deps.get("validate_upload_file")
    today_co: Callable = deps["today_co"]
    now_co: Callable = deps["now_co"]
    profile_photo_for_client = deps.get("profile_photo_for_client") or (lambda x: x)
    ALLOWED = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

    def _require_access(patient_id: int, current_user, db: Session):
        authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        return patient

    def _serialize(row) -> dict:
        return {
            "id": row.id,
            "patient_id": row.patient_id,
            "metric_id": row.metric_id,
            "date": row.date,
            "angle": row.angle or "front",
            "angle_label": ANGLE_LABELS.get(row.angle or "front", row.angle),
            "photo_url": profile_photo_for_client(row.photo_url) or row.photo_url,
            "caption": row.caption,
            "created_by": row.created_by,
            "created_at": row.created_at,
        }

    def _metric_brief(db: Session, metric_id: Optional[int]) -> Optional[dict]:
        if not metric_id or ProgressMetricDB is None:
            return None
        m = db.query(ProgressMetricDB).filter(ProgressMetricDB.id == metric_id).first()
        if not m:
            return None
        return {
            "id": m.id,
            "date": m.date.isoformat() if hasattr(m.date, "isoformat") else str(m.date),
            "weight": m.weight,
            "body_fat": m.body_fat,
            "waist": m.waist,
            "hip": m.hip,
            "notes": m.notes,
        }

    @app.get("/api/patient/{patient_id}/progress-photos")
    def list_progress_photos(
        patient_id: int,
        days: int = 365,
        angle: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_access(patient_id, current_user, db)
        if ProgressPhotoDB is None:
            return {"photos": [], "total": 0}
        q = db.query(ProgressPhotoDB).filter(ProgressPhotoDB.patient_id == patient_id)
        if angle and angle in PHOTO_ANGLES:
            q = q.filter(ProgressPhotoDB.angle == angle)
        rows = q.order_by(ProgressPhotoDB.date.desc(), ProgressPhotoDB.id.desc()).limit(200).all()
        photos = [_serialize(r) for r in rows]
        by_date = {}
        for p in photos:
            by_date.setdefault(p["date"], []).append(p)
        return {"photos": photos, "total": len(photos), "by_date": by_date}

    @app.post("/api/patient/{patient_id}/progress-photos/upload")
    async def upload_progress_photo(
        patient_id: int,
        file: UploadFile = File(...),
        angle: Optional[str] = Form("front"),
        caption: Optional[str] = Form(None),
        photo_date: Optional[str] = Form(None),
        metric_id: Optional[str] = Form(None),
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        # Solo el nutricionista (admin) o superadmin toma/registra la foto
        if getattr(current_user, "role", None) not in ("admin", "superadmin"):
            raise HTTPException(
                status_code=403,
                detail="Solo el nutricionista puede registrar fotos de progreso del paciente",
            )
        _require_access(patient_id, current_user, db)
        if ProgressPhotoDB is None:
            raise HTTPException(status_code=503, detail="Fotos de progreso no disponibles")

        ang = (angle or "front").strip().lower()
        if ang not in PHOTO_ANGLES:
            ang = "other"

        if validate_upload_file:
            await validate_upload_file(file, ALLOWED)
        else:
            ext = os.path.splitext(file.filename or "")[1].lower()
            if ext not in ALLOWED:
                raise HTTPException(status_code=400, detail="Solo imágenes permitidas")

        safe = sanitize_filename(file.filename) if sanitize_filename else (file.filename or "progress.jpg")
        ext = os.path.splitext(safe)[1].lower() or ".jpg"
        file_name = f"progress_{patient_id}_{uuid.uuid4().hex[:12]}{ext}"
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Imagen demasiado grande (máx. 5MB)")

        from media_storage import persist_upload_bytes

        photo_path = persist_upload_bytes(
            file_name, contents, content_type=file.content_type, upload_dir=UPLOAD_DIR
        )

        mid = None
        if metric_id and str(metric_id).strip().isdigit():
            mid = int(metric_id)
            if ProgressMetricDB is not None:
                m = (
                    db.query(ProgressMetricDB)
                    .filter(ProgressMetricDB.id == mid, ProgressMetricDB.patient_id == patient_id)
                    .first()
                )
                if not m:
                    raise HTTPException(status_code=404, detail="Medición no encontrada")

        d = photo_date or today_co().strftime("%Y-%m-%d")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = ProgressPhotoDB(
            patient_id=patient_id,
            metric_id=mid,
            date=d,
            angle=ang,
            photo_url=photo_path,
            caption=(caption or "").strip() or None,
            created_by=current_user.id,
            created_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {"success": True, "photo": _serialize(row)}

    @app.delete("/api/patient/{patient_id}/progress-photos/{photo_id}")
    def delete_progress_photo(
        patient_id: int,
        photo_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if getattr(current_user, "role", None) not in ("admin", "superadmin"):
            raise HTTPException(
                status_code=403,
                detail="Solo el nutricionista puede eliminar fotos de progreso",
            )
        _require_access(patient_id, current_user, db)
        if ProgressPhotoDB is None:
            raise HTTPException(status_code=404, detail="No encontrado")
        row = (
            db.query(ProgressPhotoDB)
            .filter(ProgressPhotoDB.id == photo_id, ProgressPhotoDB.patient_id == patient_id)
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Foto no encontrada")
        db.delete(row)
        db.commit()
        return {"success": True}

    @app.get("/api/patient/{patient_id}/progress-photos/compare")
    def compare_progress_photos(
        patient_id: int,
        left_id: int,
        right_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        """Compara dos fotos de progreso (antes / después) con métricas asociadas si existen."""
        _require_access(patient_id, current_user, db)
        if ProgressPhotoDB is None:
            raise HTTPException(status_code=503, detail="Fotos de progreso no disponibles")
        if left_id == right_id:
            raise HTTPException(status_code=400, detail="Selecciona dos fotos distintas")

        left = (
            db.query(ProgressPhotoDB)
            .filter(ProgressPhotoDB.id == left_id, ProgressPhotoDB.patient_id == patient_id)
            .first()
        )
        right = (
            db.query(ProgressPhotoDB)
            .filter(ProgressPhotoDB.id == right_id, ProgressPhotoDB.patient_id == patient_id)
            .first()
        )
        if not left or not right:
            raise HTTPException(status_code=404, detail="Foto no encontrada")

        # Orden cronológico: left = más antigua, right = más reciente (para “antes/después”)
        if (left.date or "") > (right.date or "") or (
            left.date == right.date and left.id > right.id
        ):
            left, right = right, left

        left_m = _metric_brief(db, left.metric_id)
        right_m = _metric_brief(db, right.metric_id)
        weight_delta = None
        if left_m and right_m and left_m.get("weight") is not None and right_m.get("weight") is not None:
            try:
                weight_delta = round(float(right_m["weight"]) - float(left_m["weight"]), 2)
            except (TypeError, ValueError):
                weight_delta = None

        return {
            "left": {**_serialize(left), "metric": left_m},
            "right": {**_serialize(right), "metric": right_m},
            "summary": {
                "days_between": None,
                "weight_delta": weight_delta,
                "same_angle": (left.angle or "front") == (right.angle or "front"),
            },
        }
