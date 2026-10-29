"""Cola de trabajo, biblioteca de intervenciones y comparador de planes."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Callable, Dict, List, Optional

from adherence_utils import days_without_meal_logs, last_meal_log_date, no_meal_logs_alert, parse_co_date
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Column, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Session


InterventionTemplateDB = None

PLAN_TIPO_LABELS = {
    "adulto": "Adulto",
    "pediatria": "Pediatría",
    "gestante": "Gestante",
    "gestante_adolescente": "Gestante adolescente",
    "hospitalizado": "Hospitalizado",
    "geriatrico": "Geriátrico",
    "deportista": "Deportista",
}

INTERVENTION_CATEGORIES = {
    "general": "General",
    "dm2": "Diabetes mellitus 2",
    "hta": "Hipertensión",
    "obesidad": "Obesidad / sobrepeso",
    "embarazo": "Embarazo y lactancia",
    "pediatria": "Pediatría",
    "renal": "Enfermedad renal",
    "dislipidemia": "Dislipidemia",
}

INTERVENTION_CONTENT_TYPES = {
    "recommendation": "Recomendación clínica",
    "message": "Mensaje al paciente",
    "smart_goal": "Meta SMART",
}

DEFAULT_INTERVENTIONS = [
    {
        "title": "Recordatorio registro de comidas",
        "category": "general",
        "content_type": "message",
        "condition_tags": ["adherencia"],
        "body": "Hola {paciente}, te recuerdo registrar tus comidas en la app al menos 3 días esta semana. Esto me ayuda a ajustar tu plan con mayor precisión. ¿Tienes alguna dificultad con algún horario?",
    },
    {
        "title": "Educación plato saludable DM2",
        "category": "dm2",
        "content_type": "recommendation",
        "condition_tags": ["dm2", "glucosa"],
        "body": "Priorizar vegetales y proteína magra en almuerzo y cena; limitar jugos, bebidas azucaradas y harinas refinadas. Preferir carbohidratos complejos en porciones medidas según tu plan.",
    },
    {
        "title": "Meta SMART — caminata",
        "category": "obesidad",
        "content_type": "smart_goal",
        "condition_tags": ["actividad"],
        "body": "Meta SMART: Caminar 30 minutos, 5 días por semana (lunes a viernes), durante las próximas 4 semanas, registrando en la app o reloj. Revisión en próxima consulta.",
    },
    {
        "title": "Reducción de sodio HTA",
        "category": "hta",
        "content_type": "recommendation",
        "condition_tags": ["hta", "sodio"],
        "body": "Evitar embutidos, sopas de sobre, snacks salados y sazonadores comerciales. Usar hierbas, limón y ajo. Leer etiquetas buscando <140 mg sodio por porción cuando sea posible.",
    },
    {
        "title": "Suplementación prenatal — recordatorio",
        "category": "embarazo",
        "content_type": "message",
        "condition_tags": ["gestante"],
        "body": "Recuerda tomar tu suplemento prescrito (ácido fólico/hierro según indicación médica) y mantener hidratación adecuada. Ante náuseas, fraccionar comidas en 5-6 tomas pequeñas.",
    },
    {
        "title": "Control de porciones",
        "category": "obesidad",
        "content_type": "recommendation",
        "condition_tags": ["porciones"],
        "body": "Usar método del plato: ½ vegetales, ¼ proteína magra, ¼ carbohidrato integral. Evitar repetir porción de carbohidratos en la misma comida salvo indicación contraria.",
    },
]


def register_nutritionist_models(Base):
    global InterventionTemplateDB

    class _InterventionTemplateDB(Base):
        __tablename__ = "intervention_templates"
        id = Column(Integer, primary_key=True, index=True)
        nutritionist_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
        title = Column(String(200), nullable=False)
        category = Column(String(50), default="general", index=True)
        content_type = Column(String(40), default="recommendation")
        condition_tags = Column(JSON, default=list)
        body = Column(Text, nullable=False)
        is_system = Column(Integer, default=0)
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    InterventionTemplateDB = _InterventionTemplateDB
    return InterventionTemplateDB


def ensure_nutritionist_schema(engine, inspect_fn, text_fn):
    try:
        inspector = inspect_fn(engine)
        if "intervention_templates" not in inspector.get_table_names():
            return
        cols = {c["name"] for c in inspector.get_columns("intervention_templates")}
        for col_name, col_sql in [
            ("condition_tags", "TEXT NULL"),
            ("is_system", "INTEGER DEFAULT 0"),
        ]:
            if col_name not in cols:
                with engine.begin() as conn:
                    conn.execute(text_fn(f"ALTER TABLE intervention_templates ADD COLUMN {col_name} {col_sql}"))
    except Exception as e:
        print(f"[NUTRITIONIST] schema migration skipped: {e}")


try:
    from phase_snapshot_module import (
        capture_patient_phase_snapshot,
        snapshot_summary,
        compare_phase_snapshots,
        serialize_snapshot_full,
        parse_captured_date,
        compare_progress_metrics,
        serialize_progress_metric,
    )
except Exception:  # pragma: no cover
    capture_patient_phase_snapshot = None  # type: ignore
    snapshot_summary = None  # type: ignore
    compare_phase_snapshots = None  # type: ignore
    serialize_snapshot_full = None  # type: ignore
    parse_captured_date = None  # type: ignore
    compare_progress_metrics = None  # type: ignore
    serialize_progress_metric = None  # type: ignore


def _tags_list(raw) -> List[str]:
    if isinstance(raw, list):
        return [str(t) for t in raw]
    if isinstance(raw, str) and raw.strip():
        import json
        try:
            parsed = json.loads(raw)
            return [str(t) for t in parsed] if isinstance(parsed, list) else []
        except Exception:
            return [t.strip() for t in raw.split(",") if t.strip()]
    return []


def _tags_store(tags: Optional[List[str]]) -> str:
    import json
    return json.dumps(tags or [])


def _intervention_dict(row, include_body: bool = True) -> dict:
    payload = {
        "id": row.id,
        "nutritionist_id": row.nutritionist_id,
        "title": row.title,
        "category": row.category or "general",
        "category_label": INTERVENTION_CATEGORIES.get(row.category or "general", row.category),
        "content_type": row.content_type or "recommendation",
        "content_type_label": INTERVENTION_CONTENT_TYPES.get(row.content_type or "recommendation", row.content_type),
        "condition_tags": _tags_list(getattr(row, "condition_tags", None)),
        "is_system": bool(getattr(row, "is_system", 0)),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }
    if include_body:
        payload["body"] = row.body
    else:
        payload["preview"] = (row.body or "")[:120]
    return payload


def _seed_default_interventions(db: Session, now_co: Callable):
    if InterventionTemplateDB is None:
        return
    existing = db.query(InterventionTemplateDB).filter(InterventionTemplateDB.is_system == 1).count()
    if existing > 0:
        return
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    for item in DEFAULT_INTERVENTIONS:
        db.add(
            InterventionTemplateDB(
                nutritionist_id=None,
                title=item["title"],
                category=item["category"],
                content_type=item["content_type"],
                condition_tags=_tags_store(item.get("condition_tags")),
                body=item["body"],
                is_system=1,
                created_at=ts,
                updated_at=ts,
            )
        )
    db.commit()


def _plan_snapshot(plan) -> dict:
    if plan is None:
        return {}
    return {
        "plan_id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "calories": plan.calories or 0,
        "protein_target": plan.protein_target or 0,
        "carbs_target": plan.carbs_target or 0,
        "fat_target": plan.fat_target or 0,
        "meals_per_day": plan.meals_per_day or 3,
        "tipo": plan.tipo or "adulto",
        "tipo_label": PLAN_TIPO_LABELS.get(plan.tipo or "adulto", plan.tipo),
        "duration": plan.duration,
        "category": plan.category,
        "fase_1": plan.fase_1 if isinstance(plan.fase_1, dict) else None,
        "fase_2": plan.fase_2 if isinstance(plan.fase_2, dict) else None,
        "fase_3": plan.fase_3 if isinstance(plan.fase_3, dict) else None,
        "fase_4": plan.fase_4 if isinstance(plan.fase_4, dict) else None,
    }


def _assignment_snapshot(assignment, plan, db: Session) -> dict:
    return {
        "assignment_id": assignment.id,
        "status": assignment.status,
        "assigned_date": assignment.assigned_date,
        "start_date": assignment.start_date,
        "end_date": assignment.end_date,
        "notes": assignment.notes,
        "current_week": assignment.current_week,
        "plan": _plan_snapshot(plan),
    }


def _compare_plan_snapshots(left: dict, right: dict) -> List[dict]:
    metrics = [
        ("calories", "Calorías", "kcal"),
        ("protein_target", "Proteína", "g"),
        ("carbs_target", "Carbohidratos", "g"),
        ("fat_target", "Grasas", "g"),
        ("meals_per_day", "Comidas/día", ""),
    ]
    changes = []
    for key, label, unit in metrics:
        lv, rv = left.get(key), right.get(key)
        if lv != rv:
            delta = (lv or 0) - (rv or 0)
            changes.append(
                {
                    "field": key,
                    "label": label,
                    "unit": unit,
                    "before": rv,
                    "after": lv,
                    "delta": delta,
                    "direction": "up" if delta > 0 else "down" if delta < 0 else "same",
                }
            )
    if left.get("tipo") != right.get("tipo"):
        changes.append(
            {
                "field": "tipo",
                "label": "Cohorte / tipo",
                "unit": "",
                "before": right.get("tipo_label") or right.get("tipo"),
                "after": left.get("tipo_label") or left.get("tipo"),
                "delta": None,
                "direction": "changed",
            }
        )
    if left.get("name") != right.get("name"):
        changes.append(
            {
                "field": "name",
                "label": "Nombre del plan",
                "unit": "",
                "before": right.get("name"),
                "after": left.get("name"),
                "delta": None,
                "direction": "changed",
            }
        )
    return changes


class InterventionCreateBody(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    category: str = "general"
    content_type: str = "recommendation"
    condition_tags: List[str] = Field(default_factory=list)
    body: str = Field(min_length=5)


class InterventionUpdateBody(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    content_type: Optional[str] = None
    condition_tags: Optional[List[str]] = None
    body: Optional[str] = None


class InterventionApplyBody(BaseModel):
    patient_id: Optional[int] = None
    patient_name: Optional[str] = None


def register_nutritionist_routes(app, deps: dict):
    get_db = deps["get_db"]
    get_current_user = deps["get_current_user"]
    UserDB = deps["UserDB"]
    MealPlanDB = deps["MealPlanDB"]
    PatientMealPlanDB = deps["PatientMealPlanDB"]
    PatientPhaseSnapshotDB = deps.get("PatientPhaseSnapshotDB")
    MealTrackingDB = deps["MealTrackingDB"]
    ProgressMetricDB = deps["ProgressMetricDB"]
    AppointmentDB = deps["AppointmentDB"]
    NutritionistNoteDB = deps.get("NutritionistNoteDB")
    authorize_patient_access = deps.get("authorize_patient_access")
    OrganizationDB = deps.get("OrganizationDB")
    OrganizationMemberDB = deps.get("OrganizationMemberDB")
    AdminProfileDB = deps.get("AdminProfileDB")
    today_co: Callable = deps["today_co"]
    now_co: Callable = deps["now_co"]
    _capture_fn = deps.get("capture_patient_phase_snapshot") or capture_patient_phase_snapshot

    def _latest_snapshot_for_assignment(db: Session, assignment_id: int):
        if PatientPhaseSnapshotDB is None:
            return None
        return (
            db.query(PatientPhaseSnapshotDB)
            .filter(PatientPhaseSnapshotDB.assignment_id == assignment_id)
            .order_by(PatientPhaseSnapshotDB.id.desc())
            .first()
        )

    def _ensure_snapshot_for_assignment(db: Session, assignment, plan):
        """Backfill: si la asignación no tiene snapshot, congela el plan actual una vez."""
        if PatientPhaseSnapshotDB is None or not _capture_fn or not assignment or not plan:
            return None
        existing = _latest_snapshot_for_assignment(db, assignment.id)
        if existing:
            return existing
        return _capture_fn(
            db,
            PatientPhaseSnapshotDB,
            patient_id=assignment.patient_id,
            assignment_id=assignment.id,
            plan=plan,
            reason="backfill",
            now_co=now_co,
        )

    def _patient_ids_for_user(db: Session, current_user) -> List[int]:
        query = db.query(UserDB.id).filter(UserDB.role == "patient", UserDB.status == "activo")
        if current_user.role == "admin":
            query = query.filter(UserDB.nutritionist_id == current_user.id)
        return [row.id for row in query.all()]

    def _patient_brief(patient) -> dict:
        return {
            "id": patient.id,
            "name": f"{patient.nombres} {patient.apellidos}",
            "avatar": patient.foto_perfil,
            "email": patient.email,
            "telefono": patient.telefono,
        }

    def _parse_date(value) -> Optional[date]:
        return parse_co_date(value)

    def _last_meal_log_date(patient_id: int, db: Session) -> Optional[date]:
        return last_meal_log_date(patient_id, db, MealTrackingDB)

    def _adherence_pct(patient_id: int, db: Session, start: date, end: date) -> int:
        base_q = db.query(MealTrackingDB).filter(
            MealTrackingDB.patient_id == patient_id,
            MealTrackingDB.date >= start,
            MealTrackingDB.date <= end,
        )
        total = base_q.count()
        completed = base_q.filter(MealTrackingDB.completed == 1).count()
        return int((completed / total) * 100) if total else 0

    def _build_at_risk_reasons(patient, db: Session, today: date) -> List[dict]:
        reasons: List[dict] = []
        start = today - timedelta(days=6)
        adherence = _adherence_pct(patient.id, db, start, today)
        days_without = days_without_meal_logs(
            patient.id, db, today, MealTrackingDB, PatientMealPlanDB
        )
        meal_alert = no_meal_logs_alert(days_without)
        if meal_alert:
            reasons.append(meal_alert)
        if adherence < 60:
            reasons.append(
                {
                    "type": "low_adherence",
                    "severity": "high" if adherence < 40 else "medium",
                    "message": f"Adherencia baja ({adherence}% en 7 días)",
                }
            )

        metrics = (
            db.query(ProgressMetricDB)
            .filter(ProgressMetricDB.patient_id == patient.id)
            .order_by(ProgressMetricDB.date.desc())
            .limit(2)
            .all()
        )
        if len(metrics) >= 2 and metrics[0].weight is not None and metrics[1].weight is not None:
            change = metrics[0].weight - metrics[1].weight
            if abs(change) >= 2:
                direction = "subió" if change > 0 else "bajó"
                reasons.append(
                    {
                        "type": "rapid_weight_change",
                        "severity": "warning",
                        "message": f"Peso {direction} {abs(change):.1f} kg recientemente",
                    }
                )
        return reasons

    def _severity_rank(severity: str) -> int:
        return {"high": 0, "warning": 1, "medium": 2, "low": 3}.get(severity, 4)

    def _make_item(
        *,
        item_id: str,
        category: str,
        priority: int,
        severity: str,
        title: str,
        description: str,
        action_path: str,
        action_label: str,
        patient=None,
        appointment_id: Optional[int] = None,
        meta: Optional[dict] = None,
    ) -> dict:
        payload = {
            "id": item_id,
            "category": category,
            "priority": priority,
            "severity": severity,
            "title": title,
            "description": description,
            "action_path": action_path,
            "action_label": action_label,
            "appointment_id": appointment_id,
            "meta": meta or {},
        }
        if patient is not None:
            payload["patient"] = _patient_brief(patient)
            payload["patient_id"] = patient.id
        else:
            payload["patient"] = None
            payload["patient_id"] = None
        return payload

    def build_work_queue_payload(db: Session, current_user) -> dict:
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")

        today = today_co()
        patient_ids = _patient_ids_for_user(db, current_user)
        items: List[dict] = []
        at_risk_patients: List[dict] = []

        if not patient_ids:
            return {
                "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
                "summary": {
                    "total_items": 0,
                    "appointments_today": 0,
                    "patients_at_risk": 0,
                    "undocumented_appointments": 0,
                    "no_active_plan": 0,
                    "plans_expiring_soon": 0,
                },
                "items": [],
                "sections": {
                    "appointments_today": [],
                    "undocumented_appointments": [],
                    "at_risk": [],
                    "no_active_plan": [],
                    "plans_expiring": [],
                },
                "at_risk_patients": [],
            }

        patients = db.query(UserDB).filter(UserDB.id.in_(patient_ids)).all()
        patient_map = {p.id: p for p in patients}

        # Citas de hoy
        today_apts = (
            db.query(AppointmentDB)
            .filter(
                AppointmentDB.patient_id.in_(patient_ids),
                AppointmentDB.date == today,
                AppointmentDB.status != "cancelada",
            )
            .order_by(AppointmentDB.time.asc())
            .all()
        )
        for apt in today_apts:
            patient = patient_map.get(apt.patient_id)
            if not patient:
                continue
            items.append(
                _make_item(
                    item_id=f"apt-today-{apt.id}",
                    category="appointment_today",
                    priority=10,
                    severity="high",
                    title=f"Cita hoy — {apt.time}",
                    description=f"{patient.nombres} {patient.apellidos} · {apt.type}",
                    action_path=f"/consultation?appointmentId={apt.id}",
                    action_label="Atender",
                    patient=patient,
                    appointment_id=apt.id,
                    meta={"time": apt.time, "type": apt.type, "status": apt.status},
                )
            )

        # Citas pasadas sin notas (últimos 7 días)
        week_ago = today - timedelta(days=7)
        past_apts = (
            db.query(AppointmentDB)
            .filter(
                AppointmentDB.patient_id.in_(patient_ids),
                AppointmentDB.date >= week_ago,
                AppointmentDB.date < today,
                AppointmentDB.status != "cancelada",
            )
            .order_by(AppointmentDB.date.desc(), AppointmentDB.time.desc())
            .limit(20)
            .all()
        )
        for apt in past_apts:
            notes_text = (apt.notes or "").strip()
            has_clinical_note = False
            if NutritionistNoteDB is not None:
                apt_date_str = apt.date.strftime("%Y-%m-%d")
                note = (
                    db.query(NutritionistNoteDB)
                    .filter(
                        NutritionistNoteDB.patient_id == apt.patient_id,
                        NutritionistNoteDB.created_at >= apt_date_str,
                    )
                    .first()
                )
                has_clinical_note = note is not None
            if notes_text or has_clinical_note:
                continue
            patient = patient_map.get(apt.patient_id)
            if not patient:
                continue
            items.append(
                _make_item(
                    item_id=f"apt-doc-{apt.id}",
                    category="undocumented_appointment",
                    priority=40,
                    severity="medium",
                    title="Cita sin documentar",
                    description=f"{patient.nombres} {patient.apellidos} · {apt.date.strftime('%d/%m/%Y')} {apt.time}",
                    action_path=f"/consultation?appointmentId={apt.id}",
                    action_label="Documentar",
                    patient=patient,
                    appointment_id=apt.id,
                    meta={"date": apt.date.strftime("%Y-%m-%d"), "time": apt.time},
                )
            )

        # Pacientes en riesgo (adherencia / logs / peso)
        for patient in patients:
            reasons = _build_at_risk_reasons(patient, db, today)
            if not reasons:
                continue
            reasons.sort(key=lambda r: _severity_rank(r["severity"]))
            top = reasons[0]
            severity = top["severity"]
            active_plan = (
                db.query(PatientMealPlanDB)
                .filter(
                    PatientMealPlanDB.patient_id == patient.id,
                    PatientMealPlanDB.status == "active",
                )
                .first()
            )
            plan_name = None
            if active_plan:
                plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
                plan_name = plan.name if plan else "Plan activo"

            adherence = _adherence_pct(patient.id, db, today - timedelta(days=6), today)
            days_without = days_without_meal_logs(
                patient.id, db, today, MealTrackingDB, PatientMealPlanDB
            )

            at_risk_entry = {
                "patient_id": patient.id,
                "name": f"{patient.nombres} {patient.apellidos}",
                "avatar": patient.foto_perfil,
                "plan": plan_name,
                "adherence_pct": adherence,
                "days_without_logs": days_without,
                "alerts_count": len(reasons),
                "alerts": reasons,
                "severity": severity,
            }
            at_risk_patients.append(at_risk_entry)

            items.append(
                _make_item(
                    item_id=f"risk-{patient.id}",
                    category="at_risk",
                    priority=20 if severity == "high" else 50,
                    severity=severity,
                    title="Paciente en riesgo",
                    description=top["message"],
                    action_path=f"/progress?patientId={patient.id}",
                    action_label="Ver adherencia",
                    patient=patient,
                    meta={
                        "adherence_pct": adherence,
                        "days_without_logs": days_without,
                        "alerts_count": len(reasons),
                    },
                )
            )

        at_risk_patients.sort(
            key=lambda p: (
                _severity_rank(p["severity"]),
                -p["alerts_count"],
                p.get("adherence_pct") or 0,
            )
        )

        # Sin plan activo
        for patient in patients:
            active = (
                db.query(PatientMealPlanDB)
                .filter(
                    PatientMealPlanDB.patient_id == patient.id,
                    PatientMealPlanDB.status == "active",
                )
                .first()
            )
            if active:
                continue
            items.append(
                _make_item(
                    item_id=f"no-plan-{patient.id}",
                    category="no_active_plan",
                    priority=45,
                    severity="medium",
                    title="Sin plan activo",
                    description=f"{patient.nombres} {patient.apellidos} no tiene plan nutricional asignado",
                    action_path=f"/patients?patientId={patient.id}",
                    action_label="Asignar plan",
                    patient=patient,
                )
            )

        # Planes por vencer (7 días)
        expiring_limit = today + timedelta(days=7)
        active_assignments = (
            db.query(PatientMealPlanDB)
            .filter(
                PatientMealPlanDB.patient_id.in_(patient_ids),
                PatientMealPlanDB.status == "active",
                PatientMealPlanDB.end_date.isnot(None),
            )
            .all()
        )
        for assignment in active_assignments:
            end = _parse_date(assignment.end_date)
            if end is None or end < today or end > expiring_limit:
                continue
            patient = patient_map.get(assignment.patient_id)
            if not patient:
                continue
            plan = db.query(MealPlanDB).filter(MealPlanDB.id == assignment.meal_plan_id).first()
            days_left = (end - today).days
            label = "hoy" if days_left == 0 else ("mañana" if days_left == 1 else f"en {days_left} días")
            items.append(
                _make_item(
                    item_id=f"expiring-{assignment.id}",
                    category="plan_expiring",
                    priority=35,
                    severity="medium" if days_left > 1 else "high",
                    title="Plan por vencer",
                    description=f"{patient.nombres} {patient.apellidos} · {plan.name if plan else 'Plan'} vence {label}",
                    action_path=f"/patients?patientId={patient.id}",
                    action_label="Renovar plan",
                    patient=patient,
                    meta={"end_date": end.strftime("%Y-%m-%d"), "days_left": days_left},
                )
            )

        items.sort(key=lambda i: (i["priority"], _severity_rank(i["severity"])))

        def _section(category: str) -> List[dict]:
            return [i for i in items if i["category"] == category]

        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "summary": {
                "total_items": len(items),
                "appointments_today": len(_section("appointment_today")),
                "patients_at_risk": len(at_risk_patients),
                "undocumented_appointments": len(_section("undocumented_appointment")),
                "no_active_plan": len(_section("no_active_plan")),
                "plans_expiring_soon": len(_section("plan_expiring")),
            },
            "items": items,
            "sections": {
                "appointments_today": _section("appointment_today"),
                "undocumented_appointments": _section("undocumented_appointment"),
                "at_risk": _section("at_risk"),
                "no_active_plan": _section("no_active_plan"),
                "plans_expiring": _section("plan_expiring"),
            },
            "at_risk_patients": at_risk_patients[:20],
        }

    @app.get("/api/nutritionist/work-queue")
    def get_nutritionist_work_queue(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        return build_work_queue_payload(db, current_user)

    # ── Biblioteca de intervenciones ──

    @app.get("/api/nutritionist/interventions/meta")
    def get_interventions_meta(current_user=Depends(get_current_user)):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        return {
            "categories": [{"value": k, "label": v} for k, v in INTERVENTION_CATEGORIES.items()],
            "content_types": [{"value": k, "label": v} for k, v in INTERVENTION_CONTENT_TYPES.items()],
        }

    @app.get("/api/nutritionist/interventions")
    def list_interventions(
        category: Optional[str] = None,
        content_type: Optional[str] = None,
        q: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        if InterventionTemplateDB is None:
            return []
        _seed_default_interventions(db, now_co)
        query = db.query(InterventionTemplateDB).filter(
            (InterventionTemplateDB.is_system == 1)
            | (InterventionTemplateDB.nutritionist_id == current_user.id)
        )
        if category and category != "all":
            query = query.filter(InterventionTemplateDB.category == category)
        if content_type and content_type != "all":
            query = query.filter(InterventionTemplateDB.content_type == content_type)
        rows = query.order_by(InterventionTemplateDB.is_system.desc(), InterventionTemplateDB.title.asc()).all()
        items = [_intervention_dict(r) for r in rows]
        if q and q.strip():
            needle = q.strip().lower()
            items = [
                i
                for i in items
                if needle in i["title"].lower()
                or needle in (i.get("body") or "").lower()
                or any(needle in t.lower() for t in i.get("condition_tags", []))
            ]
        return items

    @app.post("/api/nutritionist/interventions")
    def create_intervention(
        payload: InterventionCreateBody,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        if InterventionTemplateDB is None:
            raise HTTPException(status_code=500, detail="Modelo no disponible")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = InterventionTemplateDB(
            nutritionist_id=current_user.id,
            title=payload.title.strip(),
            category=payload.category or "general",
            content_type=payload.content_type or "recommendation",
            condition_tags=_tags_store(payload.condition_tags),
            body=payload.body.strip(),
            is_system=0,
            created_at=ts,
            updated_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _intervention_dict(row)

    @app.put("/api/nutritionist/interventions/{intervention_id}")
    def update_intervention(
        intervention_id: int,
        payload: InterventionUpdateBody,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        row = db.query(InterventionTemplateDB).filter(InterventionTemplateDB.id == intervention_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Intervención no encontrada")
        if row.is_system:
            raise HTTPException(status_code=403, detail="Las plantillas del sistema no se editan")
        if row.nutritionist_id != current_user.id and current_user.role != "superadmin":
            raise HTTPException(status_code=403, detail="No autorizado")
        if payload.title is not None:
            row.title = payload.title.strip()
        if payload.category is not None:
            row.category = payload.category
        if payload.content_type is not None:
            row.content_type = payload.content_type
        if payload.condition_tags is not None:
            row.condition_tags = _tags_store(payload.condition_tags)
        if payload.body is not None:
            row.body = payload.body.strip()
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        db.refresh(row)
        return _intervention_dict(row)

    @app.delete("/api/nutritionist/interventions/{intervention_id}")
    def delete_intervention(
        intervention_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        row = db.query(InterventionTemplateDB).filter(InterventionTemplateDB.id == intervention_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Intervención no encontrada")
        if row.is_system:
            raise HTTPException(status_code=403, detail="Las plantillas del sistema no se eliminan")
        if row.nutritionist_id != current_user.id and current_user.role != "superadmin":
            raise HTTPException(status_code=403, detail="No autorizado")
        db.delete(row)
        db.commit()
        return {"success": True}

    @app.post("/api/nutritionist/interventions/{intervention_id}/apply")
    def apply_intervention(
        intervention_id: int,
        payload: InterventionApplyBody,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        row = db.query(InterventionTemplateDB).filter(InterventionTemplateDB.id == intervention_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Intervención no encontrada")
        patient_name = payload.patient_name or "paciente"
        if payload.patient_id and authorize_patient_access:
            patient = db.query(UserDB).filter(UserDB.id == payload.patient_id).first()
            if patient:
                authorize_patient_access(payload.patient_id, current_user, db)
                patient_name = f"{patient.nombres} {patient.apellidos}".strip()
        text = (row.body or "").replace("{paciente}", patient_name)
        return {
            "intervention_id": row.id,
            "title": row.title,
            "content_type": row.content_type,
            "text": text,
        }

    # ── Comparador de planes / historial de fases ──

    @app.get("/api/nutritionist/patients/{patient_id}/plans/history")
    def get_patient_plan_history(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        if authorize_patient_access:
            authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")

        assignments = (
            db.query(PatientMealPlanDB)
            .filter(PatientMealPlanDB.patient_id == patient_id)
            .order_by(PatientMealPlanDB.id.desc())
            .all()
        )
        timeline = []
        for assignment in assignments:
            plan = db.query(MealPlanDB).filter(MealPlanDB.id == assignment.meal_plan_id).first()
            frozen = _ensure_snapshot_for_assignment(db, assignment, plan)
            live = _plan_snapshot(plan)
            summary = snapshot_summary(frozen) if frozen and snapshot_summary else {}
            timeline.append(
                {
                    "assignment_id": assignment.id,
                    "status": assignment.status,
                    "assigned_date": assignment.assigned_date,
                    "start_date": assignment.start_date,
                    "end_date": assignment.end_date,
                    "notes": assignment.notes,
                    "plan_id": summary.get("meal_plan_id") or live.get("plan_id"),
                    "plan_name": summary.get("plan_name") or live.get("name"),
                    "calories": summary.get("calories") if summary.get("calories") is not None else live.get("calories"),
                    "tipo_label": PLAN_TIPO_LABELS.get(
                        summary.get("tipo") or live.get("tipo") or "adulto",
                        summary.get("tipo") or live.get("tipo"),
                    ),
                    "snapshot_id": summary.get("snapshot_id"),
                    "captured_at": summary.get("captured_at"),
                    "has_frozen_snapshot": bool(frozen),
                    "peso_kg": summary.get("peso_kg"),
                    "requerimiento_kcal": summary.get("requerimiento_kcal"),
                    "macros_f2": summary.get("macros_f2"),
                    "grupos_con_porcion_f3": summary.get("grupos_con_porcion_f3"),
                    "has_fase4_detail": summary.get("has_fase4_detail"),
                    "imc": summary.get("imc"),
                }
            )
        try:
            db.commit()
        except Exception:
            db.rollback()

        active = next((t for t in timeline if t["status"] == "active"), None)
        previous = next((t for t in timeline if t["status"] != "active"), None)
        return {
            "patient": {"id": patient.id, "name": f"{patient.nombres} {patient.apellidos}"},
            "timeline": timeline,
            "defaults": {
                "left_assignment_id": active["assignment_id"] if active else (timeline[0]["assignment_id"] if timeline else None),
                "right_assignment_id": previous["assignment_id"] if previous else (timeline[1]["assignment_id"] if len(timeline) > 1 else None),
            },
        }

    @app.get("/api/nutritionist/patients/{patient_id}/plans/compare")
    def compare_patient_plans(
        patient_id: int,
        left_assignment_id: Optional[int] = None,
        right_assignment_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        if authorize_patient_access:
            authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")

        assignments = (
            db.query(PatientMealPlanDB)
            .filter(PatientMealPlanDB.patient_id == patient_id)
            .order_by(PatientMealPlanDB.id.desc())
            .all()
        )
        if len(assignments) < 1:
            raise HTTPException(status_code=404, detail="El paciente no tiene planes asignados")

        by_id = {a.id: a for a in assignments}
        if not left_assignment_id:
            active = next((a for a in assignments if a.status == "active"), assignments[0])
            left_assignment_id = active.id
        if not right_assignment_id:
            others = [a for a in assignments if a.id != left_assignment_id]
            right_assignment_id = others[0].id if others else left_assignment_id

        left_a = by_id.get(left_assignment_id)
        right_a = by_id.get(right_assignment_id)
        if not left_a or not right_a:
            raise HTTPException(status_code=404, detail="Asignación no encontrada")

        left_plan = db.query(MealPlanDB).filter(MealPlanDB.id == left_a.meal_plan_id).first()
        right_plan = db.query(MealPlanDB).filter(MealPlanDB.id == right_a.meal_plan_id).first()
        left_frozen = _ensure_snapshot_for_assignment(db, left_a, left_plan)
        right_frozen = _ensure_snapshot_for_assignment(db, right_a, right_plan)
        try:
            db.commit()
        except Exception:
            db.rollback()

        if left_frozen and right_frozen and compare_phase_snapshots:
            changes = compare_phase_snapshots(left_frozen, right_frozen)
            left_full = serialize_snapshot_full(left_frozen) if serialize_snapshot_full else {}
            right_full = serialize_snapshot_full(right_frozen) if serialize_snapshot_full else {}
            left_cal = (left_full.get("summary") or {}).get("calories") or 0
            right_cal = (right_full.get("summary") or {}).get("calories") or 0
        else:
            left_snap = _plan_snapshot(left_plan)
            right_snap = _plan_snapshot(right_plan)
            changes = _compare_plan_snapshots(left_snap, right_snap)
            left_full = {"plan_meta": left_snap, "fase_1": left_snap.get("fase_1"), "fase_2": left_snap.get("fase_2"), "fase_3": left_snap.get("fase_3"), "fase_4": left_snap.get("fase_4")}
            right_full = {"plan_meta": right_snap, "fase_1": right_snap.get("fase_1"), "fase_2": right_snap.get("fase_2"), "fase_3": right_snap.get("fase_3"), "fase_4": right_snap.get("fase_4")}
            left_cal = left_snap.get("calories") or 0
            right_cal = right_snap.get("calories") or 0

        by_phase: Dict[str, list] = {"meta": [], "fase_1": [], "fase_2": [], "fase_3": [], "fase_4": []}
        for c in changes:
            ph = c.get("phase") or "meta"
            if ph not in by_phase:
                by_phase[ph] = []
            by_phase[ph].append(c)

        return {
            "patient": {"id": patient.id, "name": f"{patient.nombres} {patient.apellidos}"},
            "left": {
                **_assignment_snapshot(left_a, left_plan, db),
                "snapshot": left_full,
                "has_frozen_snapshot": bool(left_frozen),
            },
            "right": {
                **_assignment_snapshot(right_a, right_plan, db),
                "snapshot": right_full,
                "has_frozen_snapshot": bool(right_frozen),
            },
            "changes": changes,
            "changes_by_phase": by_phase,
            "summary": {
                "total_changes": len(changes),
                "calorie_delta": (left_cal or 0) - (right_cal or 0),
                "phases_with_changes": [k for k, v in by_phase.items() if v],
            },
        }

    @app.get("/api/nutritionist/patients/{patient_id}/clinical-timeline")
    def get_patient_clinical_timeline(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        """Timeline unificado: snapshots de fases + métricas de progreso antropométrico."""
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        if authorize_patient_access:
            authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")

        events: List[dict] = []

        # Asegurar snapshots de asignaciones existentes
        assignments = (
            db.query(PatientMealPlanDB)
            .filter(PatientMealPlanDB.patient_id == patient_id)
            .order_by(PatientMealPlanDB.id.desc())
            .all()
        )
        for assignment in assignments:
            plan = db.query(MealPlanDB).filter(MealPlanDB.id == assignment.meal_plan_id).first()
            frozen = _ensure_snapshot_for_assignment(db, assignment, plan)
            if not frozen or not snapshot_summary:
                continue
            summary = snapshot_summary(frozen)
            events.append(
                {
                    "type": "plan_snapshot",
                    "date": (frozen.captured_at or assignment.start_date or assignment.assigned_date or "")[:10],
                    "captured_at": frozen.captured_at,
                    "assignment_id": assignment.id,
                    "snapshot_id": frozen.id,
                    "status": assignment.status,
                    "title": summary.get("plan_name") or "Plan",
                    "subtitle": f"{summary.get('calories') or '—'} kcal · RE {summary.get('requerimiento_kcal') or '—'} kcal",
                    "peso_kg": summary.get("peso_kg"),
                    "requerimiento_kcal": summary.get("requerimiento_kcal"),
                    "calories": summary.get("calories"),
                    "imc": summary.get("imc"),
                    "macros_f2": summary.get("macros_f2"),
                }
            )
        try:
            db.commit()
        except Exception:
            db.rollback()

        metrics = (
            db.query(ProgressMetricDB)
            .filter(ProgressMetricDB.patient_id == patient_id)
            .order_by(ProgressMetricDB.date.desc(), ProgressMetricDB.id.desc())
            .all()
        )
        progress_list = []
        for m in metrics:
            serialized = (
                serialize_progress_metric(m)
                if serialize_progress_metric
                else {
                    "id": m.id,
                    "date": m.date.isoformat() if hasattr(m.date, "isoformat") else str(m.date),
                    "weight": m.weight,
                    "body_fat": m.body_fat,
                    "muscle": m.muscle,
                    "water": m.water,
                    "waist": m.waist,
                    "hip": m.hip,
                    "chest": m.chest,
                    "arm": m.arm,
                    "notes": m.notes,
                }
            )
            progress_list.append(serialized)
            d = serialized["date"]
            events.append(
                {
                    "type": "progress",
                    "date": d,
                    "captured_at": serialized.get("created_at") or d,
                    "metric_id": m.id,
                    "title": "Control antropométrico",
                    "subtitle": f"Peso {m.weight} kg"
                    + (f" · grasa {m.body_fat}%" if m.body_fat is not None else ""),
                    "peso_kg": m.weight,
                    "body_fat": m.body_fat,
                    "muscle": m.muscle,
                    "water": m.water,
                    "waist": m.waist,
                    "hip": m.hip,
                    "chest": m.chest,
                    "arm": m.arm,
                    "notes": m.notes,
                }
            )

        events.sort(key=lambda e: (e.get("date") or "", e.get("captured_at") or ""), reverse=True)

        # Evolución compacta peso / RE / kcal entre snapshots
        plan_events = [e for e in events if e.get("type") == "plan_snapshot"]
        evolution = []
        for e in reversed(plan_events):
            evolution.append(
                {
                    "date": e.get("date"),
                    "plan_name": e.get("title"),
                    "peso_kg": e.get("peso_kg"),
                    "requerimiento_kcal": e.get("requerimiento_kcal"),
                    "calories": e.get("calories"),
                    "imc": e.get("imc"),
                    "assignment_id": e.get("assignment_id"),
                }
            )

        # Evolución de todos los controles de progreso (cronológico)
        progress_evolution = list(reversed(progress_list))

        return {
            "patient": {"id": patient.id, "name": f"{patient.nombres} {patient.apellidos}"},
            "events": events,
            "evolution": evolution,
            "progress_metrics": progress_list,
            "progress_evolution": progress_evolution,
            "defaults": {
                "left_metric_id": progress_list[0]["id"] if progress_list else None,
                "right_metric_id": progress_list[1]["id"] if len(progress_list) > 1 else None,
            },
        }

    @app.get("/api/nutritionist/patients/{patient_id}/progress/compare")
    def compare_patient_progress(
        patient_id: int,
        left_metric_id: Optional[int] = None,
        right_metric_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        """Compara dos (o cualquier par de) registros de progreso antropométrico."""
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        if authorize_patient_access:
            authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")

        metrics = (
            db.query(ProgressMetricDB)
            .filter(ProgressMetricDB.patient_id == patient_id)
            .order_by(ProgressMetricDB.date.desc(), ProgressMetricDB.id.desc())
            .all()
        )
        if len(metrics) < 1:
            raise HTTPException(status_code=404, detail="No hay controles de progreso registrados")

        by_id = {m.id: m for m in metrics}
        if not left_metric_id:
            left_metric_id = metrics[0].id
        if not right_metric_id:
            right_metric_id = metrics[1].id if len(metrics) > 1 else metrics[0].id

        left_m = by_id.get(left_metric_id)
        right_m = by_id.get(right_metric_id)
        if not left_m or not right_m:
            raise HTTPException(status_code=404, detail="Registro de progreso no encontrado")

        if compare_progress_metrics:
            changes = compare_progress_metrics(left_m, right_m)
        else:
            changes = []

        left_s = serialize_progress_metric(left_m) if serialize_progress_metric else {"id": left_m.id}
        right_s = serialize_progress_metric(right_m) if serialize_progress_metric else {"id": right_m.id}
        weight_delta = None
        if left_m.weight is not None and right_m.weight is not None:
            weight_delta = round(float(left_m.weight) - float(right_m.weight), 2)

        return {
            "patient": {"id": patient.id, "name": f"{patient.nombres} {patient.apellidos}"},
            "left": left_s,
            "right": right_s,
            "changes": changes,
            "summary": {
                "total_changes": len(changes),
                "weight_delta": weight_delta,
            },
            "all_metrics": [
                serialize_progress_metric(m) if serialize_progress_metric else {"id": m.id} for m in metrics
            ],
        }

    # ── Asignación masiva de menús por cohorte / EPS / org ──

    def _resolve_bulk_menu_patients(
        db: Session,
        current_user,
        cohort: Optional[str] = None,
        organization_id: Optional[int] = None,
        programa_eps: Optional[str] = None,
        require_active_plan: bool = False,
    ) -> List:
        query = db.query(UserDB).filter(UserDB.role == "patient", UserDB.status == "activo")
        if current_user.role == "admin":
            query = query.filter(UserDB.nutritionist_id == current_user.id)
        if programa_eps and programa_eps.strip() and hasattr(UserDB, "programa_eps"):
            query = query.filter(UserDB.programa_eps.ilike(f"%{programa_eps.strip()}%"))
        if organization_id and OrganizationMemberDB is not None:
            member_ids = [
                m.user_id
                for m in db.query(OrganizationMemberDB)
                .filter(
                    OrganizationMemberDB.organization_id == organization_id,
                    OrganizationMemberDB.status == "activo",
                )
                .all()
            ]
            if not member_ids:
                return []
            query = query.filter(UserDB.id.in_(member_ids))

        patients = query.all()
        if not cohort or cohort == "all":
            filtered = patients
        else:
            filtered = []
            for patient in patients:
                active = (
                    db.query(PatientMealPlanDB)
                    .filter(
                        PatientMealPlanDB.patient_id == patient.id,
                        PatientMealPlanDB.status == "active",
                    )
                    .first()
                )
                if not active:
                    if cohort == "sin_plan":
                        filtered.append(patient)
                    continue
                plan = db.query(MealPlanDB).filter(MealPlanDB.id == active.meal_plan_id).first()
                plan_tipo = getattr(plan, "tipo", None) or "adulto"
                if plan_tipo == cohort:
                    filtered.append(patient)

        if require_active_plan:
            filtered = [
                p
                for p in filtered
                if db.query(PatientMealPlanDB)
                .filter(PatientMealPlanDB.patient_id == p.id, PatientMealPlanDB.status == "active")
                .first()
            ]
        return filtered

    @app.get("/api/nutritionist/menus/bulk-preview")
    def bulk_menu_preview(
        cohort: Optional[str] = None,
        organization_id: Optional[int] = None,
        programa_eps: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        patients = _resolve_bulk_menu_patients(
            db, current_user, cohort=cohort, organization_id=organization_id, programa_eps=programa_eps
        )
        sample = [
            {
                "id": p.id,
                "name": f"{p.nombres} {p.apellidos}",
                "programa_eps": getattr(p, "programa_eps", None),
            }
            for p in patients[:12]
        ]
        org_name = None
        if organization_id and OrganizationDB is not None:
            org = db.query(OrganizationDB).filter(OrganizationDB.id == organization_id).first()
            org_name = org.name if org else None
        return {
            "count": len(patients),
            "patient_ids": [p.id for p in patients],
            "sample": sample,
            "filters": {
                "cohort": cohort,
                "organization_id": organization_id,
                "organization_name": org_name,
                "programa_eps": programa_eps,
            },
        }

    @app.get("/api/nutritionist/menus/bulk-filters")
    def bulk_menu_filters(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        eps_options = []
        if hasattr(UserDB, "programa_eps"):
            eps_options = sorted(
                {
                    p.programa_eps.strip()
                    for p in db.query(UserDB).filter(UserDB.role == "patient").all()
                    if getattr(p, "programa_eps", None) and str(p.programa_eps).strip()
                }
            )
        org_options = []
        if OrganizationDB is not None:
            org_options = [
                {"id": o.id, "name": o.name}
                for o in db.query(OrganizationDB).order_by(OrganizationDB.name.asc()).all()
            ]
        return {
            "cohorts": [{"value": k, "label": v} for k, v in PLAN_TIPO_LABELS.items()]
            + [{"value": "sin_plan", "label": "Sin plan activo"}],
            "organizations": org_options,
            "eps_programs": eps_options,
        }

    @app.get("/api/nutritionist/pdf-signature")
    def get_pdf_signature_meta(
        doc_type: str = "plan",
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        from pdf_utils import get_nutritionist_signatory, make_verification_code

        generated_at_dt = now_co()
        generated_at = generated_at_dt.strftime("%Y-%m-%d %H:%M COT")
        nutri_name, license_to, specialty = get_nutritionist_signatory(db, current_user, AdminProfileDB)
        verification_code = make_verification_code(current_user.id, doc_type, generated_at_dt)
        return {
            "nutritionist_name": nutri_name,
            "license_to": license_to,
            "specialty": specialty,
            "generated_at": generated_at,
            "verification_code": verification_code,
        }
