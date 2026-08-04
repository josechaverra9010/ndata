"""Fase 2 — panel paciente: recomendaciones, lista de compras, documentos, prep cita, adjuntos."""
from __future__ import annotations

import io
import json
import os
import re
import uuid
from datetime import date, timedelta
from typing import Any, Callable, Dict, List, Optional

from fastapi import Depends, File, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Session


PatientInterventionDB = None
AppointmentPrepChecklistDB = None

ALLOWED_MESSAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx", ".txt",
}

PREP_ITEM_DEFS = [
    {"key": "register_meals", "label": "Registrar comidas de los últimos 3 días"},
    {"key": "update_weight", "label": "Actualizar mi peso esta semana"},
    {"key": "review_menu", "label": "Revisar el menú de la semana"},
    {"key": "prepare_questions", "label": "Preparar preguntas para la consulta"},
    {"key": "confirm_attendance", "label": "Confirmar asistencia a la cita"},
]

SHOPPING_CATEGORIES = {
    "verduras_frutas": "Verduras y frutas",
    "proteinas": "Proteínas",
    "lacteos": "Lácteos",
    "granos": "Granos y cereales",
    "condimentos": "Condimentos y extras",
    "otros": "Otros",
}

CATEGORY_KEYWORDS = {
    "verduras_frutas": [
        "lechuga", "tomate", "cebolla", "zanahoria", "brócoli", "brocoli", "espinaca", "pepino",
        "papa", "patata", "manzana", "banano", "plátano", "platano", "naranja", "limón", "limon",
        "fresa", "mora", "aguacate", "apio", "pimentón", "pimenton", "col", "repollo", "arúgula",
        "arugula", "fruta", "verdura", "ensalada",
    ],
    "proteinas": [
        "pollo", "carne", "res", "cerdo", "pescado", "atún", "atun", "salmón", "salmon", "huevo",
        "huevos", "lenteja", "lentejas", "garbanzo", "frijol", "frijoles", "tofu", "jamón", "jamon",
        "pavo", "proteína", "proteina", "pechuga",
    ],
    "lacteos": ["leche", "queso", "yogurt", "yogur", "mantequilla", "crema", "kumis"],
    "granos": ["arroz", "pasta", "pan", "avena", "quinoa", "arepa", "tortilla", "cereal", "maíz", "maiz"],
    "condimentos": ["aceite", "sal", "azúcar", "azucar", "miel", "vinagre", "salsa", "especia", "ajo"],
}


class InterventionDeliverBody(BaseModel):
    patient_id: int
    patient_name: Optional[str] = None
    appointment_id: Optional[int] = None


class PrepChecklistUpdate(BaseModel):
    items: List[Dict[str, Any]]
    notes: Optional[str] = None


def register_patient_phase2_models(Base):
    global PatientInterventionDB, AppointmentPrepChecklistDB

    class _PatientInterventionDB(Base):
        __tablename__ = "patient_interventions"
        id = Column(Integer, primary_key=True, index=True)
        patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        nutritionist_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
        intervention_template_id = Column(Integer, ForeignKey("intervention_templates.id"), nullable=True)
        title = Column(String(200), nullable=False)
        body = Column(Text, nullable=False)
        content_type = Column(String(40), default="recommendation")
        category = Column(String(50), default="general")
        appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
        read_by_patient = Column(Boolean, default=False)
        created_at = Column(String(50), nullable=True)

    class _AppointmentPrepChecklistDB(Base):
        __tablename__ = "appointment_prep_checklists"
        __table_args__ = (UniqueConstraint("appointment_id", name="uq_appointment_prep"),)
        id = Column(Integer, primary_key=True, index=True)
        appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
        patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        items = Column(JSON, default=list)
        notes = Column(Text, nullable=True)
        updated_at = Column(String(50), nullable=True)

    PatientInterventionDB = _PatientInterventionDB
    AppointmentPrepChecklistDB = _AppointmentPrepChecklistDB
    return PatientInterventionDB, AppointmentPrepChecklistDB


def ensure_patient_phase2_schema(engine, inspect_fn, text_fn):
    try:
        inspector = inspect_fn(engine)
        tables = inspector.get_table_names()
        if "patient_interventions" in tables:
            cols = {c["name"] for c in inspector.get_columns("patient_interventions")}
            if "read_by_patient" not in cols:
                with engine.begin() as conn:
                    conn.execute(text_fn("ALTER TABLE patient_interventions ADD COLUMN read_by_patient BOOLEAN DEFAULT 0"))
    except Exception as e:
        print(f"[PATIENT PHASE 2] schema migration skipped: {e}")


def _ingredient_str(raw) -> Optional[str]:
    if raw is None:
        return None
    if isinstance(raw, str):
        s = raw.strip()
        return s if s else None
    if isinstance(raw, dict):
        name = raw.get("name") or raw.get("ingredient") or raw.get("text") or raw.get("item")
        portion = raw.get("portion") or raw.get("amount") or raw.get("qty")
        if name and portion:
            return f"{name} ({portion})"
        if name:
            return str(name).strip()
    if isinstance(raw, (int, float)):
        return str(raw)
    return None


def _categorize_ingredient(name: str) -> str:
    lower = name.lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(k in lower for k in keywords):
            return cat
    return "otros"


def _parse_day_meals(day_raw, db, meal_structure, key_mapping, RecipeDB=None) -> List[dict]:
    if day_raw is None:
        day_raw = {}
    if isinstance(day_raw, str):
        try:
            day_raw = json.loads(day_raw)
        except Exception:
            day_raw = {}
    if isinstance(day_raw, str):
        try:
            day_raw = json.loads(day_raw)
        except Exception:
            day_raw = {}
    day_data = day_raw
    if isinstance(day_data, list):
        day_data = day_data[0] if day_data else {}
    if isinstance(day_data, dict) and "meals" in day_data and isinstance(day_data["meals"], list):
        new_day_data = {}
        for m in day_data["meals"]:
            if isinstance(m, dict) and "type" in m:
                new_day_data[m["type"]] = m
        day_data = new_day_data

    meals_out = []

    for ms in meal_structure:
        meal_data = None
        for pk in key_mapping.get(ms["id"], [ms["id"]]):
            if pk in day_data:
                meal_data = day_data[pk]
                break
        if not meal_data:
            continue
        if isinstance(meal_data, str):
            try:
                extracted = json.loads(meal_data)
                if not isinstance(extracted, dict):
                    extracted = {"receta": str(extracted)}
            except Exception:
                extracted = {"receta": meal_data}
        else:
            extracted = meal_data if isinstance(meal_data, dict) else {}
        food_name = extracted.get("receta") or extracted.get("name") or extracted.get("recipe_name") or "Comida"
        ingredients = extracted.get("ingredients") or []
        recipe_id = extracted.get("recipe_id") or extracted.get("id")
        if (not ingredients) and recipe_id and RecipeDB is not None:
            recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
            if recipe:
                ingredients = recipe.ingredients or []
        meals_out.append({"food": food_name, "ingredients": ingredients})
    return meals_out


def register_patient_phase2_routes(app, deps: dict):
    get_db = deps["get_db"]
    get_current_user = deps["get_current_user"]
    authorize_patient_access = deps["authorize_patient_access"]
    UserDB = deps["UserDB"]
    MealPlanDB = deps["MealPlanDB"]
    PatientMealPlanDB = deps["PatientMealPlanDB"]
    MealTrackingDB = deps["MealTrackingDB"]
    ProgressMetricDB = deps["ProgressMetricDB"]
    AppointmentDB = deps["AppointmentDB"]
    WeeklyMenuDB = deps["WeeklyMenuDB"]
    RecipeDB = deps["RecipeDB"]
    NotificationDB = deps.get("NotificationDB")
    InterventionTemplateDB = deps.get("InterventionTemplateDB")
    build_nutrition_report_bytes = deps.get("build_nutrition_report_bytes")
    UPLOAD_DIR = deps.get("UPLOAD_DIR", "uploads")
    sanitize_filename = deps.get("sanitize_filename")
    validate_upload_file = deps.get("validate_upload_file")
    today_co: Callable = deps["today_co"]
    now_co: Callable = deps["now_co"]
    load_prep_item_defs_fn = deps.get("load_prep_item_defs")

    def _prep_defs(db: Session) -> List[dict]:
        if load_prep_item_defs_fn:
            return load_prep_item_defs_fn(db)
        return PREP_ITEM_DEFS

    meal_structure = [
        {"id": "breakfast", "name": "Desayuno"},
        {"id": "morning_snack", "name": "Snack AM"},
        {"id": "lunch", "name": "Almuerzo"},
        {"id": "afternoon_snack", "name": "Snack PM"},
        {"id": "dinner", "name": "Cena"},
    ]
    key_mapping = {
        "breakfast": ["breakfast", "desayuno"],
        "morning_snack": ["morning_snack", "snack_am", "media_manana", "merienda_manana"],
        "lunch": ["lunch", "comida", "almuerzo"],
        "afternoon_snack": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
        "dinner": ["dinner", "cena"],
    }
    day_map = {
        "monday": "lunes", "tuesday": "martes", "wednesday": "miercoles",
        "thursday": "jueves", "friday": "viernes", "saturday": "sabado", "sunday": "domingo",
    }

    def _require_patient(patient_id: int, current_user, db: Session):
        authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        return patient

    def _notify_patient(patient_id: int, title: str, description: str, db: Session):
        if NotificationDB is None:
            return
        db.add(
            NotificationDB(
                user_id=patient_id,
                type="recommendation",
                title=title,
                description=description[:500],
                read=False,
            )
        )

    def _collect_shopping_list(patient_id: int, db: Session, week_number: Optional[int] = None) -> dict:
        active = (
            db.query(PatientMealPlanDB)
            .filter(PatientMealPlanDB.patient_id == patient_id, PatientMealPlanDB.status == "active")
            .order_by(PatientMealPlanDB.id.desc())
            .first()
        )
        if not active:
            return {"has_plan": False, "message": "No tienes un plan activo asignado", "categories": [], "items": []}

        plan = db.query(MealPlanDB).filter(MealPlanDB.id == active.meal_plan_id).first()
        if not plan:
            return {"has_plan": False, "message": "Plan no encontrado", "categories": [], "items": []}

        target_week = week_number or active.current_week or 1
        menu = db.query(WeeklyMenuDB).filter(
            WeeklyMenuDB.meal_plan_id == plan.id,
            WeeklyMenuDB.week_number == target_week,
        ).first()
        if not menu:
            menu = db.query(WeeklyMenuDB).filter(WeeklyMenuDB.meal_plan_id == plan.id).first()
        if not menu:
            return {
                "has_plan": True,
                "plan_name": plan.name,
                "week": target_week,
                "message": "Tu nutricionista aún no ha cargado el menú para esta semana.",
                "categories": [],
                "items": [],
            }

        aggregated: Dict[str, Dict[str, Any]] = {}
        for db_day in day_map:
            day_raw = getattr(menu, db_day, {})
            for meal in _parse_day_meals(day_raw, db, meal_structure, key_mapping, RecipeDB):
                for ing in meal.get("ingredients") or []:
                    text = _ingredient_str(ing)
                    if not text:
                        continue
                    key = re.sub(r"\s+", " ", text.lower().strip())
                    cat = _categorize_ingredient(text)
                    if key not in aggregated:
                        aggregated[key] = {"name": text, "category": cat, "count": 0, "meals": set()}
                    aggregated[key]["count"] += 1
                    aggregated[key]["meals"].add(meal.get("food") or "Comida")

        items = []
        for entry in aggregated.values():
            items.append({
                "name": entry["name"],
                "category": entry["category"],
                "category_label": SHOPPING_CATEGORIES.get(entry["category"], "Otros"),
                "occurrences": entry["count"],
                "meals": sorted(entry["meals"]),
            })
        items.sort(key=lambda x: (x["category"], x["name"].lower()))

        by_cat: Dict[str, List[dict]] = {}
        for it in items:
            by_cat.setdefault(it["category"], []).append(it)

        categories = [
            {"id": cid, "label": SHOPPING_CATEGORIES.get(cid, cid), "items": by_cat[cid]}
            for cid in SHOPPING_CATEGORIES
            if cid in by_cat
        ]
        if "otros" in by_cat and not any(c["id"] == "otros" for c in categories):
            categories.append({"id": "otros", "label": "Otros", "items": by_cat["otros"]})

        return {
            "has_plan": True,
            "plan_name": plan.name,
            "week": target_week,
            "total_items": len(items),
            "categories": categories,
            "items": items,
        }

    def _default_prep_items(patient_id: int, appointment, db: Session) -> List[dict]:
        today = today_co()
        three_days_ago = today - timedelta(days=3)
        recent_logs = db.query(MealTrackingDB).filter(
            MealTrackingDB.patient_id == patient_id,
            MealTrackingDB.date >= three_days_ago,
        ).count()
        last_metric = (
            db.query(ProgressMetricDB)
            .filter(ProgressMetricDB.patient_id == patient_id)
            .order_by(ProgressMetricDB.date.desc())
            .first()
        )
        weight_ok = bool(last_metric and (today - last_metric.date).days <= 7)
        active_plan = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.patient_id == patient_id,
            PatientMealPlanDB.status == "active",
        ).first()
        confirmed = appointment.status in ("confirmada", "confirmed")

        defaults = {
            "register_meals": recent_logs >= 3,
            "update_weight": weight_ok,
            "review_menu": bool(active_plan),
            "prepare_questions": False,
            "confirm_attendance": confirmed,
        }
        prep_defs = _prep_defs(db)
        return [
            {"key": d["key"], "label": d["label"], "done": defaults.get(d["key"], False)}
            for d in prep_defs
        ]

    # ── Entregar intervención al paciente (nutricionista) ──

    @app.post("/api/nutritionist/interventions/{intervention_id}/deliver")
    def deliver_intervention_to_patient(
        intervention_id: int,
        payload: InterventionDeliverBody,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        if InterventionTemplateDB is None or PatientInterventionDB is None:
            raise HTTPException(status_code=503, detail="Módulo de intervenciones no disponible")

        row = db.query(InterventionTemplateDB).filter(InterventionTemplateDB.id == intervention_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Intervención no encontrada")

        authorize_patient_access(payload.patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == payload.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")

        patient_name = payload.patient_name or f"{patient.nombres} {patient.apellidos}".strip()
        text = (row.body or "").replace("{paciente}", patient_name)
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")

        saved = PatientInterventionDB(
            patient_id=payload.patient_id,
            nutritionist_id=current_user.id,
            intervention_template_id=row.id,
            title=row.title,
            body=text,
            content_type=row.content_type or "recommendation",
            category=row.category or "general",
            appointment_id=payload.appointment_id,
            read_by_patient=False,
            created_at=ts,
        )
        db.add(saved)
        _notify_patient(
            payload.patient_id,
            f"Nueva recomendación: {row.title}",
            text[:200],
            db,
        )
        db.commit()
        db.refresh(saved)

        return {
            "intervention_id": row.id,
            "patient_intervention_id": saved.id,
            "title": row.title,
            "content_type": row.content_type,
            "text": text,
            "delivered": True,
        }

    # ── Recomendaciones del paciente ──

    @app.get("/api/patient/{patient_id}/recommendations")
    def list_patient_recommendations(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if PatientInterventionDB is None:
            return {"items": [], "unread_count": 0}

        rows = (
            db.query(PatientInterventionDB)
            .filter(PatientInterventionDB.patient_id == patient_id)
            .order_by(PatientInterventionDB.id.desc())
            .limit(100)
            .all()
        )
        nutritionist_ids = {r.nutritionist_id for r in rows if r.nutritionist_id}
        names = {}
        if nutritionist_ids:
            for u in db.query(UserDB).filter(UserDB.id.in_(nutritionist_ids)).all():
                names[u.id] = f"{u.nombres} {u.apellidos}".strip()

        items = []
        unread = 0
        for r in rows:
            if not r.read_by_patient:
                unread += 1
            items.append({
                "id": r.id,
                "title": r.title,
                "body": r.body,
                "content_type": r.content_type,
                "category": r.category,
                "read": bool(r.read_by_patient),
                "created_at": r.created_at,
                "nutritionist_name": names.get(r.nutritionist_id, "Tu nutricionista"),
            })
        return {"items": items, "unread_count": unread}

    @app.patch("/api/patient/{patient_id}/recommendations/{rec_id}/read")
    def mark_recommendation_read(
        patient_id: int,
        rec_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if PatientInterventionDB is None:
            raise HTTPException(status_code=404, detail="No encontrado")
        row = db.query(PatientInterventionDB).filter(
            PatientInterventionDB.id == rec_id,
            PatientInterventionDB.patient_id == patient_id,
        ).first()
        if not row:
            raise HTTPException(status_code=404, detail="Recomendación no encontrada")
        row.read_by_patient = True
        db.commit()
        return {"success": True}

    @app.patch("/api/patient/{patient_id}/recommendations/read-all")
    def mark_all_recommendations_read(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if PatientInterventionDB is None:
            return {"success": True, "updated": 0}
        updated = db.query(PatientInterventionDB).filter(
            PatientInterventionDB.patient_id == patient_id,
            PatientInterventionDB.read_by_patient == False,  # noqa: E712
        ).update({PatientInterventionDB.read_by_patient: True}, synchronize_session=False)
        db.commit()
        return {"success": True, "updated": updated}

    # ── Lista de compras ──

    @app.get("/api/patient/{patient_id}/shopping-list")
    def get_patient_shopping_list(
        patient_id: int,
        week: Optional[int] = None,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        return _collect_shopping_list(patient_id, db, week)

    # ── Documentos ──

    @app.get("/api/patient/{patient_id}/documents")
    def list_patient_documents(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        patient = _require_patient(patient_id, current_user, db)
        active = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.patient_id == patient_id,
            PatientMealPlanDB.status == "active",
        ).first()
        has_metrics = db.query(ProgressMetricDB).filter(ProgressMetricDB.patient_id == patient_id).count() > 0

        docs = [
            {
                "id": "nutrition_report",
                "title": "Informe nutricional",
                "description": "Resumen profesional con medidas, IMC y evaluación nutricional.",
                "available": True,
                "download_path": f"/api/patients/{patient_id}/reports/nutrition",
            },
        ]
        if active:
            docs.append({
                "id": "plan_summary",
                "title": "Resumen del plan activo",
                "description": f"Plan: {active.meal_plan_id} — consulta tu menú semanal en Mi Plan.",
                "available": True,
                "download_path": None,
                "link_path": "/patient/my-plan",
            })
        if has_metrics:
            docs.append({
                "id": "progress_available",
                "title": "Historial de progreso",
                "description": "Consulta tus métricas y evolución en Mi Progreso.",
                "available": True,
                "download_path": None,
                "link_path": "/patient/progress",
            })
        return {"documents": docs, "patient_name": f"{patient.nombres} {patient.apellidos}".strip()}

    @app.get("/api/patient/{patient_id}/documents/nutrition-report")
    def download_patient_nutrition_report(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if not build_nutrition_report_bytes:
            raise HTTPException(status_code=503, detail="Generación de PDF no disponible")
        pdf_bytes, filename = build_nutrition_report_bytes(patient_id, db, current_user)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # ── Pre-consulta checklist ──

    @app.get("/api/patient/{patient_id}/appointments/{appointment_id}/prep")
    def get_appointment_prep_checklist(
        patient_id: int,
        appointment_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        apt = db.query(AppointmentDB).filter(
            AppointmentDB.id == appointment_id,
            AppointmentDB.patient_id == patient_id,
        ).first()
        if not apt:
            raise HTTPException(status_code=404, detail="Cita no encontrada")

        if AppointmentPrepChecklistDB is None:
            items = _default_prep_items(patient_id, apt, db)
            return {"appointment_id": appointment_id, "items": items, "notes": None, "progress_pct": 0}

        row = db.query(AppointmentPrepChecklistDB).filter(
            AppointmentPrepChecklistDB.appointment_id == appointment_id,
        ).first()
        if not row:
            items = _default_prep_items(patient_id, apt, db)
            return {"appointment_id": appointment_id, "items": items, "notes": None, "progress_pct": _progress(items)}

        items = row.items if isinstance(row.items, list) else _default_prep_items(patient_id, apt, db)
        return {
            "appointment_id": appointment_id,
            "items": items,
            "notes": row.notes,
            "progress_pct": _progress(items),
            "updated_at": row.updated_at,
        }

    @app.put("/api/patient/{patient_id}/appointments/{appointment_id}/prep")
    def update_appointment_prep_checklist(
        patient_id: int,
        appointment_id: int,
        payload: PrepChecklistUpdate,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        apt = db.query(AppointmentDB).filter(
            AppointmentDB.id == appointment_id,
            AppointmentDB.patient_id == patient_id,
        ).first()
        if not apt:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        if AppointmentPrepChecklistDB is None:
            raise HTTPException(status_code=503, detail="Checklist no disponible")

        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = db.query(AppointmentPrepChecklistDB).filter(
            AppointmentPrepChecklistDB.appointment_id == appointment_id,
        ).first()
        if not row:
            row = AppointmentPrepChecklistDB(
                appointment_id=appointment_id,
                patient_id=patient_id,
                items=payload.items,
                notes=payload.notes,
                updated_at=ts,
            )
            db.add(row)
        else:
            row.items = payload.items
            row.notes = payload.notes
            row.updated_at = ts
        db.commit()
        return {"success": True, "progress_pct": _progress(payload.items)}

    # ── Adjuntos en mensajes ──

    @app.post("/api/messages/upload")
    async def upload_message_attachment(
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin", "patient"):
            raise HTTPException(status_code=403, detail="Acceso denegado")

        if validate_upload_file:
            await validate_upload_file(file, ALLOWED_MESSAGE_EXTENSIONS)
        else:
            ext = os.path.splitext(file.filename or "")[1].lower()
            if ext not in ALLOWED_MESSAGE_EXTENSIONS:
                raise HTTPException(status_code=400, detail="Tipo de archivo no permitido")

        safe_name = sanitize_filename(file.filename) if sanitize_filename else (file.filename or "file")
        ext = os.path.splitext(safe_name)[1].lower() or ".bin"
        file_name = f"msg_{current_user.id}_{uuid.uuid4().hex[:12]}{ext}"
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(UPLOAD_DIR, file_name)
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Archivo demasiado grande (máx. 5MB)")
        with open(file_path, "wb") as buffer:
            buffer.write(contents)

        url = f"/uploads/{file_name}"
        msg_type = "image" if ext in {".jpg", ".jpeg", ".png", ".gif", ".webp"} else "file"
        return {
            "success": True,
            "url": url,
            "filename": safe_name,
            "type": msg_type,
        }


def _progress(items: List[dict]) -> int:
    if not items:
        return 0
    done = sum(1 for i in items if i.get("done"))
    return int((done / len(items)) * 100)

