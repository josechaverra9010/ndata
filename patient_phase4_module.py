"""Fase 4 — panel paciente: diario fotográfico, PWA/offline, wearables, sustituciones IA."""
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import date, timedelta
from typing import Any, Callable, Dict, List, Optional

from fastapi import Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Session


MealPhotoDB = None
WearableSnapshotDB = None
OfflineSyncLogDB = None

# Grupos de sustitución nutricional (reglas clínicas simplificadas)
SUBSTITUTION_GROUPS: Dict[str, dict] = {
    "pollo": {
        "category": "Proteína magra",
        "alternatives": [
            {"name": "Pechuga de pavo", "portion": "120 g", "reason": "Proteína similar, menos grasa saturada"},
            {"name": "Filete de tilapia", "portion": "130 g", "reason": "Proteína magra, fácil digestión"},
            {"name": "Lomo de cerdo magro", "portion": "110 g", "reason": "Intercambio 1:1 en proteínas"},
            {"name": "Tofu firme", "portion": "150 g", "reason": "Opción vegetal rica en proteína"},
            {"name": "Huevo entero", "portion": "2 unidades", "reason": "Proteína completa de alta calidad"},
        ],
    },
    "pechuga de pollo": {
        "category": "Proteína magra",
        "alternatives": [
            {"name": "Pechuga de pavo", "portion": "120 g", "reason": "Intercambio directo"},
            {"name": "Merluza o bagre", "portion": "140 g", "reason": "Pescado blanco magro"},
            {"name": "Pechuga de pollo sin piel", "portion": "120 g", "reason": "Misma porción si tienes otra presentación"},
        ],
    },
    "pescado": {
        "category": "Proteína magra",
        "alternatives": [
            {"name": "Salmón", "portion": "100 g", "reason": "Grasas saludables omega-3"},
            {"name": "Atún en agua", "portion": "120 g", "reason": "Proteína magra práctica"},
            {"name": "Pechuga de pollo", "portion": "120 g", "reason": "Intercambio clásico de proteína magra"},
        ],
    },
    "arroz": {
        "category": "Carbohidrato",
        "alternatives": [
            {"name": "Quinoa cocida", "portion": "150 g", "reason": "Más proteína y fibra"},
            {"name": "Papa cocida", "portion": "200 g", "reason": "Carbohidrato de absorción moderada"},
            {"name": "Pasta integral", "portion": "140 g cocida", "reason": "Similar energía, más fibra"},
            {"name": "Arepa de maíz", "portion": "1 unidad mediana", "reason": "Opción regional equivalente"},
        ],
    },
    "pasta": {
        "category": "Carbohidrato",
        "alternatives": [
            {"name": "Arroz integral", "portion": "150 g cocido", "reason": "Mismo grupo de intercambio"},
            {"name": "Cuscús integral", "portion": "140 g", "reason": "Preparación rápida similar"},
            {"name": "Spaghetti de calabacín", "portion": "200 g", "reason": "Menos calorías, más volumen"},
        ],
    },
    "pan": {
        "category": "Carbohidrato",
        "alternatives": [
            {"name": "Arepa integral", "portion": "1 unidad", "reason": "Equivalente regional"},
            {"name": "Tortilla de maíz", "portion": "2 unidades", "reason": "Porción similar en carbohidratos"},
            {"name": "Avena en hojuelas", "portion": "40 g seca", "reason": "Carbohidrato complejo"},
        ],
    },
    "leche": {
        "category": "Lácteo",
        "alternatives": [
            {"name": "Yogurt natural sin azúcar", "portion": "200 ml", "reason": "Calcio y proteína similares"},
            {"name": "Bebida de soya fortificada", "portion": "200 ml", "reason": "Opción sin lactosa"},
            {"name": "Kumis bajo en azúcar", "portion": "200 ml", "reason": "Probióticos + calcio"},
        ],
    },
    "huevo": {
        "category": "Proteína",
        "alternatives": [
            {"name": "Claras de huevo", "portion": "3 unidades", "reason": "Proteína sin grasa del huevo"},
            {"name": "Queso cottage", "portion": "100 g", "reason": "Proteína de alta calidad"},
            {"name": "Tofu suave", "portion": "120 g", "reason": "Alternativa vegetal"},
        ],
    },
    "carne de res": {
        "category": "Proteína",
        "alternatives": [
            {"name": "Lomo de cerdo magro", "portion": "110 g", "reason": "Menos grasa saturada"},
            {"name": "Pechuga de pollo", "portion": "120 g", "reason": "Proteína magra preferida"},
            {"name": "Lentejas cocidas", "portion": "180 g", "reason": "Proteína vegetal + fibra"},
        ],
    },
    "ensalada": {
        "category": "Verdura",
        "alternatives": [
            {"name": "Vegetales al vapor", "portion": "200 g", "reason": "Mismo grupo, diferente preparación"},
            {"name": "Sopa de verduras", "portion": "1 taza", "reason": "Aporta volumen y saciedad"},
            {"name": "Verduras asadas", "portion": "180 g", "reason": "Más sabor, mismos micronutrientes"},
        ],
    },
}

KEYWORD_ALIASES = {
    "pollo": ["pollo", "pechuga", "muslo", "contramuslo"],
    "pescado": ["pescado", "tilapia", "salmón", "salmon", "atún", "atun", "merluza", "bagre"],
    "arroz": ["arroz", "integral"],
    "pasta": ["pasta", "espagueti", "spaghetti", "fideos"],
    "pan": ["pan", "tostada", "arepa"],
    "leche": ["leche", "lácteo", "lacteo"],
    "huevo": ["huevo", "huevos", "omelet"],
    "carne de res": ["carne", "res", "lomo", "cerdo"],
}


class SubstitutionRequest(BaseModel):
    ingredient: str = Field(min_length=2, max_length=120)
    meal_type: Optional[str] = None
    reason: Optional[str] = None  # no_tengo, no_gusta, alergia


class WearableUpdateBody(BaseModel):
    steps: Optional[int] = Field(None, ge=0, le=100000)
    active_minutes: Optional[int] = Field(None, ge=0, le=600)
    source: Optional[str] = "manual"


class OfflineSyncItem(BaseModel):
    action: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    client_id: str
    created_at: Optional[str] = None


class OfflineSyncBody(BaseModel):
    items: List[OfflineSyncItem]


def register_patient_phase4_models(Base):
    global MealPhotoDB, WearableSnapshotDB, OfflineSyncLogDB

    class _MealPhotoDB(Base):
        __tablename__ = "meal_photos"
        id = Column(Integer, primary_key=True, index=True)
        patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        date = Column(String(20), nullable=False, index=True)
        meal_type = Column(String(50), nullable=True)
        photo_url = Column(String(500), nullable=False)
        caption = Column(Text, nullable=True)
        created_at = Column(String(50), nullable=True)

    class _WearableSnapshotDB(Base):
        __tablename__ = "wearable_snapshots"
        __table_args__ = (UniqueConstraint("patient_id", "date", name="uq_wearable_patient_date"),)
        id = Column(Integer, primary_key=True, index=True)
        patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        date = Column(String(20), nullable=False, index=True)
        steps = Column(Integer, default=0)
        active_minutes = Column(Integer, default=0)
        source = Column(String(40), default="manual")
        updated_at = Column(String(50), nullable=True)

    class _OfflineSyncLogDB(Base):
        __tablename__ = "offline_sync_logs"
        id = Column(Integer, primary_key=True, index=True)
        patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        client_id = Column(String(80), nullable=False, index=True)
        action = Column(String(60), nullable=False)
        status = Column(String(20), default="ok")
        created_at = Column(String(50), nullable=True)

    MealPhotoDB = _MealPhotoDB
    WearableSnapshotDB = _WearableSnapshotDB
    OfflineSyncLogDB = _OfflineSyncLogDB
    return MealPhotoDB, WearableSnapshotDB, OfflineSyncLogDB


def ensure_patient_phase4_schema(engine, inspect_fn, text_fn):
    pass


def _normalize_ingredient(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def _find_substitution_group(ingredient: str, groups: Optional[Dict[str, dict]] = None) -> Optional[tuple]:
    pool = groups if groups is not None else SUBSTITUTION_GROUPS
    norm = _normalize_ingredient(ingredient)
    if norm in pool:
        return norm, pool[norm]
    for key, data in pool.items():
        keywords = data.get("keywords") or KEYWORD_ALIASES.get(key, [key])
        if any(k in norm for k in keywords):
            return key, data
    for key in pool:
        if key in norm or norm in key:
            return key, pool[key]
    return None


def register_patient_phase4_routes(app, deps: dict):
    get_db = deps["get_db"]
    get_current_user = deps["get_current_user"]
    authorize_patient_access = deps["authorize_patient_access"]
    UserDB = deps["UserDB"]
    MealTrackingDB = deps["MealTrackingDB"]
    WaterTrackingDB = deps.get("WaterTrackingDB")
    RecipeDB = deps.get("RecipeDB")
    PatientHabitLogDB = deps.get("PatientHabitLogDB")
    UPLOAD_DIR = deps.get("UPLOAD_DIR", "uploads")
    sanitize_filename = deps.get("sanitize_filename")
    validate_upload_file = deps.get("validate_upload_file")
    today_co: Callable = deps["today_co"]
    now_co: Callable = deps["now_co"]
    load_substitution_groups_fn = deps.get("load_substitution_groups")

    def _groups(db: Session) -> Dict[str, dict]:
        if load_substitution_groups_fn:
            return load_substitution_groups_fn(db)
        return SUBSTITUTION_GROUPS

    IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

    def _require_patient(patient_id: int, current_user, db: Session):
        authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        return patient

    def _filter_allergies(alternatives: List[dict], patient) -> List[dict]:
        alergias = (getattr(patient, "alergias", None) or "").lower()
        disgusto = (getattr(patient, "alimentos_disgusto", None) or "").lower()
        blocked = alergias + " " + disgusto
        if not blocked.strip():
            return alternatives
        out = []
        for alt in alternatives:
            name_lower = alt["name"].lower()
            if any(b in name_lower for b in blocked.split() if len(b) > 3):
                continue
            out.append(alt)
        return out or alternatives

    # ── Diario fotográfico ──

    @app.get("/api/patient/{patient_id}/meal-photos")
    def list_meal_photos(
        patient_id: int,
        date_filter: Optional[str] = None,
        days: int = 14,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if MealPhotoDB is None:
            return {"photos": [], "total": 0}

        q = db.query(MealPhotoDB).filter(MealPhotoDB.patient_id == patient_id)
        if date_filter:
            q = q.filter(MealPhotoDB.date == date_filter)
        else:
            since = (today_co() - timedelta(days=max(1, min(days, 90)))).strftime("%Y-%m-%d")
            q = q.filter(MealPhotoDB.date >= since)

        rows = q.order_by(MealPhotoDB.date.desc(), MealPhotoDB.id.desc()).limit(100).all()
        photos = [
            {
                "id": r.id,
                "date": r.date,
                "meal_type": r.meal_type,
                "photo_url": r.photo_url,
                "caption": r.caption,
                "created_at": r.created_at,
            }
            for r in rows
        ]
        by_date: Dict[str, List] = {}
        for p in photos:
            by_date.setdefault(p["date"], []).append(p)
        return {"photos": photos, "total": len(photos), "by_date": by_date}

    @app.post("/api/patient/{patient_id}/meal-photos/upload")
    async def upload_meal_photo(
        patient_id: int,
        file: UploadFile = File(...),
        meal_type: Optional[str] = Form(None),
        caption: Optional[str] = Form(None),
        photo_date: Optional[str] = Form(None),
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if MealPhotoDB is None:
            raise HTTPException(status_code=503, detail="Diario fotográfico no disponible")

        if validate_upload_file:
            await validate_upload_file(file, IMAGE_EXTENSIONS)
        else:
            ext = os.path.splitext(file.filename or "")[1].lower()
            if ext not in IMAGE_EXTENSIONS:
                raise HTTPException(status_code=400, detail="Solo imágenes permitidas")

        safe = sanitize_filename(file.filename) if sanitize_filename else (file.filename or "photo.jpg")
        ext = os.path.splitext(safe)[1].lower() or ".jpg"
        file_name = f"meal_{patient_id}_{uuid.uuid4().hex[:12]}{ext}"
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Imagen demasiado grande (máx. 5MB)")
        with open(os.path.join(UPLOAD_DIR, file_name), "wb") as buffer:
            buffer.write(contents)

        d = photo_date or today_co().strftime("%Y-%m-%d")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = MealPhotoDB(
            patient_id=patient_id,
            date=d,
            meal_type=meal_type,
            photo_url=f"/uploads/{file_name}",
            caption=(caption or "").strip() or None,
            created_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "success": True,
            "id": row.id,
            "photo_url": row.photo_url,
            "date": row.date,
            "meal_type": row.meal_type,
        }

    @app.delete("/api/patient/{patient_id}/meal-photos/{photo_id}")
    def delete_meal_photo(
        patient_id: int,
        photo_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if MealPhotoDB is None:
            raise HTTPException(status_code=404, detail="No encontrado")
        row = db.query(MealPhotoDB).filter(
            MealPhotoDB.id == photo_id,
            MealPhotoDB.patient_id == patient_id,
        ).first()
        if not row:
            raise HTTPException(status_code=404, detail="Foto no encontrada")
        db.delete(row)
        db.commit()
        return {"success": True}

    # ── Sustituciones inteligentes ──

    @app.post("/api/patient/{patient_id}/substitutions/suggest")
    def suggest_food_substitutions(
        patient_id: int,
        body: SubstitutionRequest,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        patient = _require_patient(patient_id, current_user, db)
        ingredient = body.ingredient.strip()
        match = _find_substitution_group(ingredient, _groups(db))

        recipe_suggestions = []
        if RecipeDB is not None:
            recipes = db.query(RecipeDB).filter(RecipeDB.name.isnot(None)).limit(200).all()
            ing_lower = _normalize_ingredient(ingredient)
            for rec in recipes:
                ings = rec.ingredients or []
                if isinstance(ings, str):
                    try:
                        ings = json.loads(ings)
                    except Exception:
                        ings = [ings]
                text_ings = " ".join(str(i) for i in ings).lower()
                if ing_lower in text_ings or any(k in text_ings for k in ing_lower.split()):
                    if ing_lower not in (rec.name or "").lower():
                        recipe_suggestions.append({
                            "name": rec.name,
                            "type": "recipe",
                            "reason": "Receta del plan que no incluye ese ingrediente",
                            "calories": rec.calories or 0,
                        })
            recipe_suggestions = recipe_suggestions[:4]

        if not match:
            return {
                "ingredient": ingredient,
                "found": False,
                "message": "No encontramos un grupo de intercambio exacto. Prueba con el alimento base (ej. 'pollo', 'arroz').",
                "alternatives": [],
                "recipe_suggestions": recipe_suggestions,
                "tip": "Consulta a tu nutricionista antes de cambiar porciones de forma habitual.",
            }

        key, group = match
        alternatives = _filter_allergies(group["alternatives"], patient)
        reason_prefix = ""
        if body.reason == "no_tengo":
            reason_prefix = "No tienes el ingrediente — "
        elif body.reason == "no_gusta":
            reason_prefix = "Preferencia personal — "
        elif body.reason == "alergia":
            reason_prefix = "Por alergia/intolerancia — "

        return {
            "ingredient": ingredient,
            "matched_group": key,
            "category": group["category"],
            "found": True,
            "message": f"{reason_prefix}Alternativas equivalentes en {group['category']}",
            "alternatives": alternatives,
            "recipe_suggestions": recipe_suggestions,
            "ai_note": "Sugerencias basadas en grupos de intercambio nutricional EVANUT. Ajusta porciones según tu plan.",
        }

    @app.get("/api/patient/{patient_id}/substitutions/popular")
    def popular_substitutions(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        groups = _groups(db)
        items = [
            {"ingredient": k, "category": v["category"], "preview": v["alternatives"][0]["name"] if v.get("alternatives") else ""}
            for k, v in list(groups.items())[:8]
        ]
        return {"items": items}

    # ── Wearables / actividad ──

    @app.get("/api/patient/{patient_id}/wearables/today")
    def get_wearables_today(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        today_str = today_co().strftime("%Y-%m-%d")
        row = None
        if WearableSnapshotDB is not None:
            row = db.query(WearableSnapshotDB).filter(
                WearableSnapshotDB.patient_id == patient_id,
                WearableSnapshotDB.date == today_str,
            ).first()
        goal_steps = 8000
        return {
            "date": today_str,
            "steps": row.steps if row else 0,
            "active_minutes": row.active_minutes if row else 0,
            "goal_steps": goal_steps,
            "progress_pct": min(100, int(((row.steps if row else 0) / goal_steps) * 100)),
            "source": row.source if row else "manual",
        }

    @app.put("/api/patient/{patient_id}/wearables/today")
    def update_wearables_today(
        patient_id: int,
        payload: WearableUpdateBody,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if WearableSnapshotDB is None:
            raise HTTPException(status_code=503, detail="Wearables no disponible")

        today_str = today_co().strftime("%Y-%m-%d")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = db.query(WearableSnapshotDB).filter(
            WearableSnapshotDB.patient_id == patient_id,
            WearableSnapshotDB.date == today_str,
        ).first()
        if not row:
            row = WearableSnapshotDB(patient_id=patient_id, date=today_str, updated_at=ts)
            db.add(row)
        if payload.steps is not None:
            row.steps = payload.steps
        if payload.active_minutes is not None:
            row.active_minutes = payload.active_minutes
        if payload.source:
            row.source = payload.source
        row.updated_at = ts
        db.commit()
        return {"success": True, "steps": row.steps, "active_minutes": row.active_minutes}

    @app.get("/api/patient/{patient_id}/wearables/week")
    def get_wearables_week(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        today = today_co()
        start = today - timedelta(days=6)
        series = []
        if WearableSnapshotDB is not None:
            rows = db.query(WearableSnapshotDB).filter(
                WearableSnapshotDB.patient_id == patient_id,
                WearableSnapshotDB.date >= start.strftime("%Y-%m-%d"),
            ).all()
            by_date = {r.date: r for r in rows}
        else:
            by_date = {}

        for offset in range(6, -1, -1):
            d = today - timedelta(days=offset)
            ds = d.strftime("%Y-%m-%d")
            r = by_date.get(ds)
            series.append({
                "date": ds,
                "label": d.strftime("%d/%m"),
                "steps": r.steps if r else 0,
                "active_minutes": r.active_minutes if r else 0,
            })
        total_steps = sum(s["steps"] for s in series)
        return {"series": series, "total_steps": total_steps, "avg_steps": int(total_steps / 7)}

    # ── Sincronización offline ──

    @app.post("/api/patient/{patient_id}/offline/sync")
    def sync_offline_actions(
        patient_id: int,
        body: OfflineSyncBody,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        results = []
        today = today_co()

        for item in body.items:
            status = "ok"
            error = None
            try:
                if OfflineSyncLogDB is not None:
                    dup = db.query(OfflineSyncLogDB).filter(
                        OfflineSyncLogDB.patient_id == patient_id,
                        OfflineSyncLogDB.client_id == item.client_id,
                    ).first()
                    if dup:
                        results.append({"client_id": item.client_id, "status": "duplicate", "action": item.action})
                        continue

                if item.action == "complete_meal":
                    meal_type = item.payload.get("meal_type")
                    if meal_type:
                        tracking = db.query(MealTrackingDB).filter(
                            MealTrackingDB.patient_id == patient_id,
                            MealTrackingDB.date == today,
                            MealTrackingDB.meal_type == meal_type,
                        ).first()
                        if tracking:
                            tracking.completed = 1
                        else:
                            db.add(MealTrackingDB(
                                patient_id=patient_id,
                                date=today,
                                meal_type=meal_type,
                                completed=1,
                                created_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
                            ))

                elif item.action == "add_water" and WaterTrackingDB is not None:
                    ml = int(item.payload.get("glass_ml", 250))
                    wt = db.query(WaterTrackingDB).filter(
                        WaterTrackingDB.patient_id == patient_id,
                        WaterTrackingDB.date == today,
                    ).first()
                    if wt:
                        wt.amount_ml += ml
                    else:
                        db.add(WaterTrackingDB(patient_id=patient_id, date=today, amount_ml=ml))

                elif item.action == "log_habit" and PatientHabitLogDB is not None:
                    today_str = today.strftime("%Y-%m-%d")
                    habit = db.query(PatientHabitLogDB).filter(
                        PatientHabitLogDB.patient_id == patient_id,
                        PatientHabitLogDB.date == today_str,
                    ).first()
                    if not habit:
                        habit = PatientHabitLogDB(patient_id=patient_id, date=today_str)
                        db.add(habit)
                    for field in ("sleep_hours", "exercise_minutes", "stress_level", "mood"):
                        if field in item.payload and item.payload[field] is not None:
                            setattr(habit, field, item.payload[field])

                else:
                    status = "skipped"
                    error = f"Acción no soportada: {item.action}"

                if OfflineSyncLogDB is not None and status == "ok":
                    db.add(OfflineSyncLogDB(
                        patient_id=patient_id,
                        client_id=item.client_id,
                        action=item.action,
                        status=status,
                        created_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
                    ))
            except Exception as e:
                status = "error"
                error = str(e)

            results.append({"client_id": item.client_id, "status": status, "action": item.action, "error": error})

        db.commit()
        return {"success": True, "synced": len([r for r in results if r["status"] == "ok"]), "results": results}
