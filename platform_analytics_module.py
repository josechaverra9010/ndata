"""
Analítica de plataforma NutriData — embudo, cohortes, módulos, sesiones, NPS.
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import Column, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase

PlatformModuleUsageDB = None
PlatformAppSessionDB = None
NpsSurveyDB = None

PATIENT_MODULE_LABELS = {
    "dashboard": "Inicio",
    "my_plan": "Mi Plan",
    "meal_tracking": "Registro comidas",
    "appointments": "Citas",
    "progress": "Progreso",
    "recipes": "Recetas",
    "habits": "Hábitos",
    "learn": "Aprendizaje",
    "challenges": "Retos",
    "water": "Agua",
    "support": "Ayuda",
    "notifications": "Notificaciones",
    "program": "Programa EPS",
}

NUTRITIONIST_MODULE_LABELS = {
    "dashboard": "Dashboard",
    "patients": "Pacientes",
    "plans": "Planes",
    "appointments": "Agenda",
    "clinical": "Clínica Colombia",
    "analytics": "Adherencia",
    "work_queue": "Cola de trabajo",
    "recipes": "Recetas",
    "menus": "Menús semanales",
    "messages": "Mensajes",
    "interventions": "Intervenciones",
    "consultation": "Consulta",
}

FUNNEL_STAGES = [
    ("registered", "Registro"),
    ("profile_complete", "Perfil completo"),
    ("first_plan", "Primer plan"),
    ("adherence_70", "Adherencia ≥70%"),
]


class ModuleTrackSchema(BaseModel):
    module_key: str
    route: Optional[str] = None


class SessionTrackSchema(BaseModel):
    session_id: Optional[str] = None
    action: str = Field(..., description="start | heartbeat | end")
    duration_seconds: Optional[int] = None


class NpsSubmitSchema(BaseModel):
    score: int = Field(..., ge=0, le=10)
    comment: Optional[str] = None
    appointment_id: Optional[int] = None
    context: str = "post_consultation"


def register_platform_analytics_models(Base):
    global PlatformModuleUsageDB, PlatformAppSessionDB, NpsSurveyDB

    class _PlatformModuleUsageDB(Base):
        __tablename__ = "platform_module_usage"
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        user_role = Column(String(20), nullable=False, index=True)
        module_key = Column(String(80), nullable=False, index=True)
        route = Column(String(200), nullable=True)
        hit_count = Column(Integer, default=1)
        last_seen_at = Column(String(50), nullable=True, index=True)
        created_at = Column(String(50), nullable=True)

    class _PlatformAppSessionDB(Base):
        __tablename__ = "platform_app_sessions"
        id = Column(Integer, primary_key=True, index=True)
        session_id = Column(String(64), nullable=False, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        user_role = Column(String(20), nullable=False)
        started_at = Column(String(50), nullable=True)
        last_heartbeat_at = Column(String(50), nullable=True)
        ended_at = Column(String(50), nullable=True)
        duration_seconds = Column(Integer, default=0)
        page_views = Column(Integer, default=1)

    class _NpsSurveyDB(Base):
        __tablename__ = "nps_surveys"
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True, index=True)
        nutritionist_id = Column(Integer, ForeignKey("users.id"), nullable=True)
        score = Column(Integer, nullable=False)
        comment = Column(Text, nullable=True)
        context = Column(String(50), default="post_consultation")
        created_at = Column(String(50), nullable=True, index=True)

    PlatformModuleUsageDB = _PlatformModuleUsageDB
    PlatformAppSessionDB = _PlatformAppSessionDB
    NpsSurveyDB = _NpsSurveyDB
    return PlatformModuleUsageDB, PlatformAppSessionDB, NpsSurveyDB


def migrate_platform_analytics_schema(engine, inspect_fn, text_fn):
    try:
        inspector = inspect_fn(engine)
        tables = inspector.get_table_names()
        for model in (PlatformModuleUsageDB, PlatformAppSessionDB, NpsSurveyDB):
            if model is not None and model.__tablename__ not in tables:
                model.__table__.create(bind=engine, checkfirst=True)
    except Exception as exc:
        print(f"[MIGRATE] platform_analytics: {exc}")


def _parse_date_str(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def _month_key(d: date) -> str:
    return d.strftime("%Y-%m")


def _profile_complete(user) -> bool:
    if user.altura is None or user.peso_actual is None or user.nivel_actividad is None:
        return False
    return True


def _patient_adherence_pct(db: Session, MealTrackingDB, patient_id: int, start: date, end: date) -> int:
    base = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date >= start,
        MealTrackingDB.date <= end,
    )
    total = base.count()
    if not total:
        return 0
    done = base.filter(MealTrackingDB.completed == 1).count()
    return int((done / total) * 100)


def _patient_reached_adherence_70(db: Session, MealTrackingDB, patient_id: int, today: date) -> bool:
    """Adherencia ≥70% en alguna ventana móvil de 7 días en los últimos 90 días."""
    for offset in range(0, 90, 7):
        end = today - timedelta(days=offset)
        start = end - timedelta(days=6)
        if _patient_adherence_pct(db, MealTrackingDB, patient_id, start, end) >= 70:
            return True
    return False


def _patient_active_in_month(
    db: Session,
    MealTrackingDB,
    AppointmentDB,
    patient_id: int,
    month_start: date,
) -> bool:
    if month_start.month == 12:
        next_month = date(month_start.year + 1, 1, 1)
    else:
        next_month = date(month_start.year, month_start.month + 1, 1)
    meal = (
        db.query(MealTrackingDB.id)
        .filter(
            MealTrackingDB.patient_id == patient_id,
            MealTrackingDB.date >= month_start,
            MealTrackingDB.date < next_month,
        )
        .first()
    )
    if meal:
        return True
    appt = (
        db.query(AppointmentDB.id)
        .filter(
            AppointmentDB.patient_id == patient_id,
            AppointmentDB.date >= month_start,
            AppointmentDB.date < next_month,
        )
        .first()
    )
    return appt is not None


def _build_funnel(db: Session, deps: dict) -> dict:
    UserDB = deps["UserDB"]
    PatientMealPlanDB = deps["PatientMealPlanDB"]
    MealTrackingDB = deps["MealTrackingDB"]
    today = deps["today_co"]()

    patients = (
        db.query(UserDB)
        .filter(UserDB.role == "patient")
        .all()
    )
    registered = len(patients)
    profile_ids = [p.id for p in patients if _profile_complete(p)]

    plan_rows = (
        db.query(PatientMealPlanDB.patient_id)
        .distinct()
        .all()
    )
    plan_ids = {r[0] for r in plan_rows}

    adherence_ids = [
        p.id for p in patients
        if _patient_reached_adherence_70(db, MealTrackingDB, p.id, today)
    ]

    stages = [
        {"key": "registered", "label": "Registro", "count": registered},
        {"key": "profile_complete", "label": "Perfil completo", "count": len(profile_ids)},
        {"key": "first_plan", "label": "Primer plan", "count": len(plan_ids & {p.id for p in patients})},
        {"key": "adherence_70", "label": "Adherencia ≥70%", "count": len(adherence_ids)},
    ]

    prev_count = registered or 1
    funnel = []
    for stage in stages:
        count = stage["count"]
        conversion_from_prev = round((count / prev_count) * 100, 1) if prev_count else 0
        conversion_from_top = round((count / registered) * 100, 1) if registered else 0
        funnel.append({
            **stage,
            "conversion_from_previous_pct": conversion_from_prev,
            "conversion_from_registration_pct": conversion_from_top,
        })
        prev_count = count or prev_count

    return {
        "total_registered": registered,
        "stages": funnel,
        "drop_off": {
            "registration_to_profile": registered - len(profile_ids),
            "profile_to_plan": len(profile_ids) - len(plan_ids & {p.id for p in patients}),
            "plan_to_adherence": len(plan_ids & {p.id for p in patients}) - len(adherence_ids),
        },
    }


def _build_cohorts(db: Session, deps: dict, months: int = 12) -> dict:
    UserDB = deps["UserDB"]
    PatientMealPlanDB = deps["PatientMealPlanDB"]
    MealTrackingDB = deps["MealTrackingDB"]
    AppointmentDB = deps["AppointmentDB"]
    today = deps["today_co"]()

    patients = (
        db.query(UserDB)
        .filter(UserDB.role == "patient", UserDB.created_at.isnot(None))
        .all()
    )

    plan_patient_ids = {
        r[0] for r in db.query(PatientMealPlanDB.patient_id).distinct().all()
    }

    by_cohort: Dict[str, list] = defaultdict(list)
    for p in patients:
        reg = _parse_date_str(p.created_at)
        if not reg:
            continue
        by_cohort[_month_key(reg)].append(p)

    cohort_keys = sorted(by_cohort.keys())[-months:]
    rows = []
    max_retention_months = 6

    for ck in cohort_keys:
        cohort_patients = by_cohort[ck]
        size = len(cohort_patients)
        reg_year, reg_month = map(int, ck.split("-"))
        cohort_start = date(reg_year, reg_month, 1)

        profile_n = sum(1 for p in cohort_patients if _profile_complete(p))
        plan_n = sum(1 for p in cohort_patients if p.id in plan_patient_ids)
        adh_n = sum(
            1 for p in cohort_patients
            if _patient_reached_adherence_70(db, MealTrackingDB, p.id, today)
        )

        retention = []
        for m in range(max_retention_months + 1):
            if cohort_start.month + m > 12:
                ms = date(cohort_start.year + (cohort_start.month + m - 1) // 12, ((cohort_start.month + m - 1) % 12) + 1, 1)
            else:
                ms = date(cohort_start.year, cohort_start.month + m, 1)
            if ms > today.replace(day=1):
                break
            active = sum(
                1 for p in cohort_patients
                if _patient_active_in_month(db, MealTrackingDB, AppointmentDB, p.id, ms)
            )
            retention.append({
                "month_offset": m,
                "month": ms.strftime("%Y-%m"),
                "active_users": active,
                "retention_pct": round((active / size) * 100, 1) if size else 0,
            })

        rows.append({
            "cohort_month": ck,
            "size": size,
            "profile_complete_pct": round((profile_n / size) * 100, 1) if size else 0,
            "first_plan_pct": round((plan_n / size) * 100, 1) if size else 0,
            "adherence_70_pct": round((adh_n / size) * 100, 1) if size else 0,
            "retention": retention,
        })

    return {"cohorts": rows, "months_analyzed": months}


def _derive_module_usage_from_data(db: Session, deps: dict, since_str: str) -> dict:
    """Proxy de uso cuando no hay eventos de tracking."""
    UserDB = deps["UserDB"]
    MealTrackingDB = deps["MealTrackingDB"]
    AppointmentDB = deps["AppointmentDB"]
    PatientMealPlanDB = deps["PatientMealPlanDB"]
    ProgressMetricDB = deps.get("ProgressMetricDB")
    PatientHabitLogDB = deps.get("PatientHabitLogDB")
    WaterTrackingDB = deps.get("WaterTrackingDB")
    SupportTicketDB = deps.get("SupportTicketDB")
    NutritionistNoteDB = deps.get("NutritionistNoteDB")

    since_date = _parse_date_str(since_str) or (deps["today_co"]() - timedelta(days=30))

    patient_modules = []
    meal_users = db.query(MealTrackingDB.patient_id).filter(MealTrackingDB.date >= since_date).distinct().count()
    patient_modules.append({"module_key": "meal_tracking", "label": PATIENT_MODULE_LABELS["meal_tracking"], "unique_users": meal_users, "events": db.query(MealTrackingDB).filter(MealTrackingDB.date >= since_date).count()})

    appt_users = db.query(AppointmentDB.patient_id).filter(AppointmentDB.date >= since_date).distinct().count()
    patient_modules.append({"module_key": "appointments", "label": PATIENT_MODULE_LABELS["appointments"], "unique_users": appt_users, "events": db.query(AppointmentDB).filter(AppointmentDB.date >= since_date).count()})

    if ProgressMetricDB is not None:
        prog_users = db.query(ProgressMetricDB.patient_id).filter(ProgressMetricDB.date >= since_date).distinct().count()
        patient_modules.append({"module_key": "progress", "label": PATIENT_MODULE_LABELS["progress"], "unique_users": prog_users, "events": db.query(ProgressMetricDB).filter(ProgressMetricDB.date >= since_date).count()})

    if PatientHabitLogDB is not None:
        habit_users = db.query(PatientHabitLogDB.patient_id).filter(PatientHabitLogDB.date >= since_str[:10]).distinct().count()
        patient_modules.append({"module_key": "habits", "label": PATIENT_MODULE_LABELS["habits"], "unique_users": habit_users, "events": db.query(PatientHabitLogDB).filter(PatientHabitLogDB.date >= since_str[:10]).count()})

    if WaterTrackingDB is not None:
        water_users = db.query(WaterTrackingDB.patient_id).filter(WaterTrackingDB.date >= since_date).distinct().count()
        patient_modules.append({"module_key": "water", "label": PATIENT_MODULE_LABELS["water"], "unique_users": water_users, "events": db.query(WaterTrackingDB).filter(WaterTrackingDB.date >= since_date).count()})

    if SupportTicketDB is not None:
        ticket_users = db.query(SupportTicketDB.patient_id).filter(SupportTicketDB.created_at >= since_str).distinct().count()
        patient_modules.append({"module_key": "support", "label": PATIENT_MODULE_LABELS["support"], "unique_users": ticket_users, "events": db.query(SupportTicketDB).filter(SupportTicketDB.created_at >= since_str).count()})

    plan_users = db.query(PatientMealPlanDB.patient_id).filter(PatientMealPlanDB.assigned_date >= since_str[:10]).distinct().count()
    patient_modules.append({"module_key": "my_plan", "label": PATIENT_MODULE_LABELS["my_plan"], "unique_users": plan_users, "events": db.query(PatientMealPlanDB).filter(PatientMealPlanDB.assigned_date >= since_str[:10]).count()})

    nutritionist_modules = []
    active_nutris = db.query(UserDB).filter(UserDB.role == "admin", UserDB.status == "activo").count()
    patients_managed = db.query(UserDB).filter(UserDB.role == "patient", UserDB.nutritionist_id.isnot(None)).count()
    nutritionist_modules.append({"module_key": "patients", "label": NUTRITIONIST_MODULE_LABELS["patients"], "unique_users": active_nutris, "events": patients_managed})

    plans_created = db.query(PatientMealPlanDB).filter(PatientMealPlanDB.assigned_date >= since_str[:10]).count()
    nutritionist_modules.append({"module_key": "plans", "label": NUTRITIONIST_MODULE_LABELS["plans"], "unique_users": active_nutris, "events": plans_created})

    nutritionist_modules.append({"module_key": "appointments", "label": NUTRITIONIST_MODULE_LABELS["appointments"], "unique_users": active_nutris, "events": db.query(AppointmentDB).filter(AppointmentDB.date >= since_date).count()})

    if NutritionistNoteDB is not None:
        notes = db.query(NutritionistNoteDB).filter(NutritionistNoteDB.created_at >= since_str).count()
        nutritionist_modules.append({"module_key": "consultation", "label": NUTRITIONIST_MODULE_LABELS["consultation"], "unique_users": active_nutris, "events": notes})

    patient_modules.sort(key=lambda x: x["events"], reverse=True)
    nutritionist_modules.sort(key=lambda x: x["events"], reverse=True)

    return {
        "source": "derived",
        "patient": patient_modules,
        "nutritionist": nutritionist_modules,
    }


def _build_module_usage(db: Session, deps: dict, days: int) -> dict:
    PlatformModuleUsageDB = deps["PlatformModuleUsageDB"]
    since_dt = deps["now_co"]() - timedelta(days=days)
    since_str = since_dt.strftime("%Y-%m-%d %H:%M:%S")

    tracked = (
        db.query(
            PlatformModuleUsageDB.user_role,
            PlatformModuleUsageDB.module_key,
            func.sum(PlatformModuleUsageDB.hit_count).label("events"),
            func.count(func.distinct(PlatformModuleUsageDB.user_id)).label("unique_users"),
        )
        .filter(PlatformModuleUsageDB.last_seen_at >= since_str)
        .group_by(PlatformModuleUsageDB.user_role, PlatformModuleUsageDB.module_key)
        .all()
    )

    if not tracked:
        return {**_derive_module_usage_from_data(db, deps, since_str), "days": days}

    patient_rows = []
    nutritionist_rows = []
    for row in tracked:
        role, key, events, users = row[0], row[1], int(row[2] or 0), int(row[3] or 0)
        item = {
            "module_key": key,
            "label": PATIENT_MODULE_LABELS.get(key) or NUTRITIONIST_MODULE_LABELS.get(key) or key,
            "unique_users": users,
            "events": events,
        }
        if role == "patient":
            patient_rows.append(item)
        else:
            nutritionist_rows.append(item)

    patient_rows.sort(key=lambda x: x["events"], reverse=True)
    nutritionist_rows.sort(key=lambda x: x["events"], reverse=True)

    return {
        "source": "tracked",
        "days": days,
        "patient": patient_rows,
        "nutritionist": nutritionist_rows,
    }


def _build_sessions_stats(db: Session, deps: dict, days: int) -> dict:
    PlatformAppSessionDB = deps["PlatformAppSessionDB"]
    since_dt = deps["now_co"]() - timedelta(days=days)
    since_str = since_dt.strftime("%Y-%m-%d %H:%M:%S")

    sessions = (
        db.query(PlatformAppSessionDB)
        .filter(PlatformAppSessionDB.started_at >= since_str)
        .all()
    )

    if not sessions:
        return {
            "days": days,
            "total_sessions": 0,
            "avg_duration_seconds": 0,
            "median_duration_seconds": 0,
            "avg_duration_minutes": 0,
            "by_role": {},
            "daily": [],
        }

    durations = [s.duration_seconds or 0 for s in sessions if (s.duration_seconds or 0) > 0]
    durations_sorted = sorted(durations)
    median = durations_sorted[len(durations_sorted) // 2] if durations_sorted else 0
    avg = int(sum(durations) / len(durations)) if durations else 0

    by_role: Dict[str, dict] = defaultdict(lambda: {"sessions": 0, "total_seconds": 0})
    for s in sessions:
        role = s.user_role or "unknown"
        by_role[role]["sessions"] += 1
        by_role[role]["total_seconds"] += s.duration_seconds or 0

    role_stats = {}
    for role, data in by_role.items():
        n = data["sessions"]
        role_stats[role] = {
            "sessions": n,
            "avg_duration_seconds": int(data["total_seconds"] / n) if n else 0,
            "avg_duration_minutes": round((data["total_seconds"] / n) / 60, 1) if n else 0,
        }

    daily_map: Dict[str, int] = defaultdict(int)
    for s in sessions:
        if s.started_at:
            daily_map[s.started_at[:10]] += 1
    daily = [{"date": k, "sessions": daily_map[k]} for k in sorted(daily_map.keys())]

    return {
        "days": days,
        "total_sessions": len(sessions),
        "avg_duration_seconds": avg,
        "median_duration_seconds": median,
        "avg_duration_minutes": round(avg / 60, 1),
        "by_role": role_stats,
        "daily": daily[-30:],
    }


def _nps_category(score: int) -> str:
    if score >= 9:
        return "promoter"
    if score >= 7:
        return "passive"
    return "detractor"


def _build_nps_stats(db: Session, deps: dict, days: int) -> dict:
    NpsSurveyDB = deps["NpsSurveyDB"]
    UserDB = deps["UserDB"]
    since_dt = deps["now_co"]() - timedelta(days=days)
    since_str = since_dt.strftime("%Y-%m-%d %H:%M:%S")

    rows = (
        db.query(NpsSurveyDB)
        .filter(NpsSurveyDB.created_at >= since_str)
        .order_by(NpsSurveyDB.created_at.desc())
        .all()
    )

    total = len(rows)
    promoters = sum(1 for r in rows if _nps_category(r.score) == "promoter")
    passives = sum(1 for r in rows if _nps_category(r.score) == "passive")
    detractors = sum(1 for r in rows if _nps_category(r.score) == "detractor")
    nps_score = round(((promoters - detractors) / total) * 100, 1) if total else 0
    avg_score = round(sum(r.score for r in rows) / total, 2) if total else 0

    distribution = [{"score": s, "count": sum(1 for r in rows if r.score == s)} for s in range(11)]

    recent = []
    for r in rows[:50]:
        user = db.query(UserDB).filter(UserDB.id == r.user_id).first()
        recent.append({
            "id": r.id,
            "score": r.score,
            "category": _nps_category(r.score),
            "comment": r.comment,
            "context": r.context,
            "appointment_id": r.appointment_id,
            "user_name": f"{user.nombres} {user.apellidos}" if user else f"Usuario #{r.user_id}",
            "created_at": r.created_at,
        })

    post_consultation = [r for r in rows if r.context == "post_consultation"]
    pc_total = len(post_consultation)
    pc_promoters = sum(1 for r in post_consultation if _nps_category(r.score) == "promoter")
    pc_detractors = sum(1 for r in post_consultation if _nps_category(r.score) == "detractor")
    post_nps = round(((pc_promoters - pc_detractors) / pc_total) * 100, 1) if pc_total else 0

    return {
        "days": days,
        "total_responses": total,
        "nps_score": nps_score,
        "avg_score": avg_score,
        "promoters": promoters,
        "passives": passives,
        "detractors": detractors,
        "post_consultation_nps": post_nps,
        "post_consultation_count": pc_total,
        "distribution": distribution,
        "recent": recent,
    }


def register_platform_analytics_routes(app, deps: dict):
    get_db = deps["get_db"]
    require_superadmin = deps["require_superadmin"]
    get_current_user = deps["get_current_user"]
    UserDB = deps["UserDB"]
    now_co = deps["now_co"]

    PlatformModuleUsageDB = deps["PlatformModuleUsageDB"]
    PlatformAppSessionDB = deps["PlatformAppSessionDB"]
    NpsSurveyDB = deps["NpsSurveyDB"]
    AppointmentDB = deps.get("AppointmentDB")

    @app.get("/api/superadmin/analytics/overview")
    def superadmin_analytics_overview(
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        funnel = _build_funnel(db, deps)
        cohorts = _build_cohorts(db, deps, months=6)
        modules = _build_module_usage(db, deps, days=30)
        sessions = _build_sessions_stats(db, deps, days=30)
        nps = _build_nps_stats(db, deps, days=90)

        latest_cohort = cohorts["cohorts"][-1] if cohorts["cohorts"] else None

        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "funnel_summary": {
                "registered": funnel["total_registered"],
                "profile_complete": next((s["count"] for s in funnel["stages"] if s["key"] == "profile_complete"), 0),
                "first_plan": next((s["count"] for s in funnel["stages"] if s["key"] == "first_plan"), 0),
                "adherence_70": next((s["count"] for s in funnel["stages"] if s["key"] == "adherence_70"), 0),
            },
            "nps_score": nps["nps_score"],
            "post_consultation_nps": nps["post_consultation_nps"],
            "avg_session_minutes": sessions["avg_duration_minutes"],
            "top_patient_module": modules["patient"][0] if modules.get("patient") else None,
            "top_nutritionist_module": modules["nutritionist"][0] if modules.get("nutritionist") else None,
            "latest_cohort": latest_cohort,
        }

    @app.get("/api/superadmin/analytics/funnel")
    def superadmin_analytics_funnel(
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        return _build_funnel(db, deps)

    @app.get("/api/superadmin/analytics/cohorts")
    def superadmin_analytics_cohorts(
        months: int = Query(12, ge=3, le=24),
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        return _build_cohorts(db, deps, months=months)

    @app.get("/api/superadmin/analytics/modules")
    def superadmin_analytics_modules(
        days: int = Query(30, ge=7, le=90),
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        return _build_module_usage(db, deps, days=days)

    @app.get("/api/superadmin/analytics/sessions")
    def superadmin_analytics_sessions(
        days: int = Query(30, ge=7, le=90),
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        return _build_sessions_stats(db, deps, days=days)

    @app.get("/api/superadmin/analytics/nps")
    def superadmin_analytics_nps(
        days: int = Query(90, ge=30, le=365),
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        return _build_nps_stats(db, deps, days=days)

    @app.post("/api/analytics/track/module")
    def track_module_usage(
        body: ModuleTrackSchema,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("patient", "admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = (
            db.query(PlatformModuleUsageDB)
            .filter(
                PlatformModuleUsageDB.user_id == current_user.id,
                PlatformModuleUsageDB.module_key == body.module_key,
            )
            .first()
        )
        if row:
            row.hit_count = (row.hit_count or 0) + 1
            row.last_seen_at = ts
            row.route = body.route or row.route
        else:
            db.add(PlatformModuleUsageDB(
                user_id=current_user.id,
                user_role=current_user.role if current_user.role != "superadmin" else "admin",
                module_key=body.module_key,
                route=body.route,
                hit_count=1,
                last_seen_at=ts,
                created_at=ts,
            ))
        db.commit()
        return {"success": True}

    @app.post("/api/analytics/track/session")
    def track_app_session(
        body: SessionTrackSchema,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("patient", "admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")

        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        session_id = body.session_id or str(uuid.uuid4())
        role = current_user.role if current_user.role != "superadmin" else "admin"

        if body.action == "start":
            db.add(PlatformAppSessionDB(
                session_id=session_id,
                user_id=current_user.id,
                user_role=role,
                started_at=ts,
                last_heartbeat_at=ts,
                duration_seconds=0,
                page_views=1,
            ))
            db.commit()
            return {"success": True, "session_id": session_id}

        row = (
            db.query(PlatformAppSessionDB)
            .filter(
                PlatformAppSessionDB.session_id == session_id,
                PlatformAppSessionDB.user_id == current_user.id,
            )
            .order_by(PlatformAppSessionDB.id.desc())
            .first()
        )
        if not row:
            db.add(PlatformAppSessionDB(
                session_id=session_id,
                user_id=current_user.id,
                user_role=role,
                started_at=ts,
                last_heartbeat_at=ts,
                duration_seconds=body.duration_seconds or 0,
                page_views=1,
            ))
            db.commit()
            return {"success": True, "session_id": session_id}

        if body.action == "heartbeat":
            row.last_heartbeat_at = ts
            row.page_views = (row.page_views or 0) + 1
            if body.duration_seconds is not None:
                row.duration_seconds = max(row.duration_seconds or 0, body.duration_seconds)
        elif body.action == "end":
            row.ended_at = ts
            row.last_heartbeat_at = ts
            if body.duration_seconds is not None:
                row.duration_seconds = body.duration_seconds
            elif row.started_at:
                try:
                    start = datetime.strptime(row.started_at[:19], "%Y-%m-%d %H:%M:%S")
                    end = datetime.strptime(ts[:19], "%Y-%m-%d %H:%M:%S")
                    row.duration_seconds = max(0, int((end - start).total_seconds()))
                except Exception:
                    pass
        db.commit()
        return {"success": True, "session_id": session_id}

    @app.post("/api/analytics/nps")
    def submit_nps(
        body: NpsSubmitSchema,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role != "patient":
            raise HTTPException(status_code=403, detail="Solo pacientes pueden enviar NPS")

        if body.appointment_id and AppointmentDB is not None:
            appt = db.query(AppointmentDB).filter(AppointmentDB.id == body.appointment_id).first()
            if not appt or appt.patient_id != current_user.id:
                raise HTTPException(status_code=404, detail="Cita no encontrada")
            existing = (
                db.query(NpsSurveyDB)
                .filter(
                    NpsSurveyDB.user_id == current_user.id,
                    NpsSurveyDB.appointment_id == body.appointment_id,
                )
                .first()
            )
            if existing:
                raise HTTPException(status_code=400, detail="Ya enviaste encuesta para esta cita")
            nutritionist_id = current_user.nutritionist_id
        else:
            nutritionist_id = current_user.nutritionist_id

        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.add(NpsSurveyDB(
            user_id=current_user.id,
            appointment_id=body.appointment_id,
            nutritionist_id=nutritionist_id,
            score=body.score,
            comment=(body.comment or "").strip() or None,
            context=body.context,
            created_at=ts,
        ))
        db.commit()
        return {"success": True, "message": "Gracias por tu feedback"}

    @app.get("/api/superadmin/analytics/export")
    def export_analytics_csv(
        days: int = Query(30, ge=7, le=365),
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        """Export CSV resumen funnel + módulos + NPS."""
        import csv
        import io
        from fastapi.responses import Response

        funnel = _build_funnel(db, deps)
        modules = _build_module_usage(db, deps, days=days)
        nps = _build_nps_stats(db, deps, days=days)
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["NutriData Analytics Export", deps["now_co"]().strftime("%Y-%m-%d %H:%M:%S")])
        w.writerow([])
        w.writerow(["Funnel", "Count", "Conversion %"])
        for stage in funnel.get("stages") or []:
            w.writerow([stage.get("label") or stage.get("key"), stage.get("count"), stage.get("conversion_from_top")])
        w.writerow([])
        w.writerow(["Módulo", "Rol", "Eventos", "Usuarios únicos"])
        for m in (modules.get("patient") or []) + (modules.get("nutritionist") or []):
            w.writerow([m.get("module_key") or m.get("label"), "patient" if m in (modules.get("patient") or []) else "nutritionist", m.get("events"), m.get("unique_users")])
        w.writerow([])
        w.writerow(["NPS score", nps.get("nps_score")])
        w.writerow(["Promotores", nps.get("promoters")])
        w.writerow(["Detractores", nps.get("detractors")])
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=analytics-{days}d.csv"},
        )

    @app.get("/api/analytics/nps/pending")
    def pending_nps_surveys(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        """Citas pasadas confirmadas sin encuesta NPS (últimos 30 días)."""
        if current_user.role != "patient" or AppointmentDB is None:
            return {"pending": []}

        today = deps["today_co"]()
        since = today - timedelta(days=30)

        past_appts = (
            db.query(AppointmentDB)
            .filter(
                AppointmentDB.patient_id == current_user.id,
                AppointmentDB.date >= since,
                AppointmentDB.date < today,
                AppointmentDB.status == "confirmada",
            )
            .order_by(AppointmentDB.date.desc())
            .all()
        )

        surveyed_ids = {
            r[0]
            for r in db.query(NpsSurveyDB.appointment_id)
            .filter(
                NpsSurveyDB.user_id == current_user.id,
                NpsSurveyDB.appointment_id.isnot(None),
            )
            .all()
            if r[0]
        }

        pending = []
        for a in past_appts:
            if a.id in surveyed_ids:
                continue
            pending.append({
                "appointment_id": a.id,
                "date": a.date.strftime("%Y-%m-%d") if hasattr(a.date, "strftime") else str(a.date),
                "time": a.time,
                "type": a.type,
                "nutritionist_id": current_user.nutritionist_id,
            })
        return {"pending": pending[:5]}
