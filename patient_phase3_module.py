"""Fase 3 — panel paciente: retos, educación, programa EPS, hábitos, recordatorios."""
from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any, Callable, Dict, List, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Session


PatientChallengeClaimDB = None
PatientHabitLogDB = None
PatientReminderPrefsDB = None

CHALLENGE_DEFS = [
    {
        "key": "daily_water",
        "title": "Hidratación del día",
        "description": "Bebe al menos 2 litros de agua hoy",
        "target": 2000,
        "metric": "water_ml_today",
        "points": 10,
        "icon": "droplets",
        "period": "daily",
    },
    {
        "key": "week_meals_5",
        "title": "5 comidas registradas",
        "description": "Completa al menos 5 comidas esta semana",
        "target": 5,
        "metric": "completed_meals_week",
        "points": 25,
        "icon": "utensils",
        "period": "weekly",
    },
    {
        "key": "week_adherence_70",
        "title": "Adherencia semanal 70%",
        "description": "Alcanza al menos 70% de adherencia esta semana",
        "target": 70,
        "metric": "week_adherence_pct",
        "points": 30,
        "icon": "target",
        "period": "weekly",
    },
    {
        "key": "log_weight_week",
        "title": "Peso de la semana",
        "description": "Registra tu peso al menos una vez esta semana",
        "target": 1,
        "metric": "weight_logs_week",
        "points": 15,
        "icon": "scale",
        "period": "weekly",
    },
    {
        "key": "streak_3",
        "title": "Racha de 3 días",
        "description": "Registra comidas 3 días consecutivos",
        "target": 3,
        "metric": "streak_days",
        "points": 20,
        "icon": "flame",
        "period": "rolling",
    },
]

CONDITION_ARTICLE_KEYWORDS = {
    "diabetes": ["diabetes", "dm2", "glucosa", "azúcar", "insulina"],
    "obesidad": ["obesidad", "sobrepeso", "peso", "adelgazar", "calorías"],
    "hipertension": ["hipertensión", "hta", "sodio", "sal", "presión"],
    "embarazo": ["embarazo", "gestante", "prenatal", "lactancia"],
    "renal": ["renal", "riñón", "creatinina"],
    "dislipidemia": ["colesterol", "lípidos", "triglicéridos", "hdl", "ldl"],
}

DEFAULT_MEAL_REMINDERS = {
    "breakfast": "07:30",
    "lunch": "12:30",
    "dinner": "19:00",
}


class HabitUpdateBody(BaseModel):
    sleep_hours: Optional[float] = Field(None, ge=0, le=24)
    exercise_minutes: Optional[int] = Field(None, ge=0, le=600)
    stress_level: Optional[int] = Field(None, ge=1, le=5)
    digestion_notes: Optional[str] = None
    mood: Optional[str] = None


class ReminderPrefsUpdate(BaseModel):
    meal_reminders: Optional[Dict[str, str]] = None
    whatsapp_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    weekly_report: Optional[bool] = None
    tips_enabled: Optional[bool] = None


def register_patient_phase3_models(Base):
    global PatientChallengeClaimDB, PatientHabitLogDB, PatientReminderPrefsDB

    class _PatientChallengeClaimDB(Base):
        __tablename__ = "patient_challenge_claims"
        __table_args__ = (UniqueConstraint("patient_id", "challenge_key", "period_key", name="uq_patient_challenge_period"),)
        id = Column(Integer, primary_key=True, index=True)
        patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        challenge_key = Column(String(60), nullable=False)
        period_key = Column(String(20), nullable=False)
        points = Column(Integer, default=0)
        claimed_at = Column(String(50), nullable=True)

    class _PatientHabitLogDB(Base):
        __tablename__ = "patient_habit_logs"
        __table_args__ = (UniqueConstraint("patient_id", "date", name="uq_patient_habit_date"),)
        id = Column(Integer, primary_key=True, index=True)
        patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        date = Column(String(20), nullable=False, index=True)
        sleep_hours = Column(Float, nullable=True)
        exercise_minutes = Column(Integer, default=0)
        stress_level = Column(Integer, nullable=True)
        digestion_notes = Column(Text, nullable=True)
        mood = Column(String(40), nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _PatientReminderPrefsDB(Base):
        __tablename__ = "patient_reminder_prefs"
        id = Column(Integer, primary_key=True, index=True)
        patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
        meal_reminders = Column(JSON, default=dict)
        whatsapp_enabled = Column(Boolean, default=False)
        email_enabled = Column(Boolean, default=True)
        push_enabled = Column(Boolean, default=True)
        weekly_report = Column(Boolean, default=True)
        tips_enabled = Column(Boolean, default=True)
        updated_at = Column(String(50), nullable=True)

    PatientChallengeClaimDB = _PatientChallengeClaimDB
    PatientHabitLogDB = _PatientHabitLogDB
    PatientReminderPrefsDB = _PatientReminderPrefsDB
    return PatientChallengeClaimDB, PatientHabitLogDB, PatientReminderPrefsDB


def ensure_patient_phase3_schema(engine, inspect_fn, text_fn):
    pass


def register_patient_phase3_routes(app, deps: dict):
    get_db = deps["get_db"]
    get_current_user = deps["get_current_user"]
    authorize_patient_access = deps["authorize_patient_access"]
    UserDB = deps["UserDB"]
    MealPlanDB = deps["MealPlanDB"]
    PatientMealPlanDB = deps["PatientMealPlanDB"]
    MealTrackingDB = deps["MealTrackingDB"]
    ProgressMetricDB = deps["ProgressMetricDB"]
    AppointmentDB = deps["AppointmentDB"]
    WaterTrackingDB = deps["WaterTrackingDB"]
    AchievementDB = deps.get("AchievementDB")
    ArticleDB = deps.get("ArticleDB")
    NotificationDB = deps.get("NotificationDB")
    OrganizationDB = deps.get("OrganizationDB")
    OrganizationMemberDB = deps.get("OrganizationMemberDB")
    calculate_weekly_adherence = deps.get("calculate_weekly_adherence")
    send_whatsapp_notification = deps.get("send_whatsapp_notification")
    today_co: Callable = deps["today_co"]
    now_co: Callable = deps["now_co"]
    load_challenge_defs_fn = deps.get("load_challenge_defs")

    def _get_challenge_defs(db: Session) -> List[dict]:
        if load_challenge_defs_fn:
            return load_challenge_defs_fn(db)
        return CHALLENGE_DEFS

    def _require_patient(patient_id: int, current_user, db: Session):
        authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        return patient

    def _week_start(d: date) -> date:
        return d - timedelta(days=d.weekday())

    def _period_key(challenge: dict, today: date) -> str:
        if challenge.get("period") == "daily":
            return today.strftime("%Y-%m-%d")
        if challenge.get("period") == "weekly":
            return _week_start(today).strftime("%Y-%m-%d")
        return "rolling"

    def _meal_streak(patient_id: int, db: Session, today: date) -> int:
        streak = 0
        d = today
        for _ in range(30):
            count = db.query(MealTrackingDB).filter(
                MealTrackingDB.patient_id == patient_id,
                MealTrackingDB.date == d,
                MealTrackingDB.completed == 1,
            ).count()
            if count > 0:
                streak += 1
                d -= timedelta(days=1)
            else:
                break
        return streak

    def _metrics(patient_id: int, db: Session, today: date) -> dict:
        week_start = _week_start(today)
        completed_week = db.query(MealTrackingDB).filter(
            MealTrackingDB.patient_id == patient_id,
            MealTrackingDB.date >= week_start,
            MealTrackingDB.date <= today,
            MealTrackingDB.completed == 1,
        ).count()
        week_adherence = calculate_weekly_adherence(patient_id, db) if calculate_weekly_adherence else 0
        weight_logs = db.query(ProgressMetricDB).filter(
            ProgressMetricDB.patient_id == patient_id,
            ProgressMetricDB.date >= week_start,
            ProgressMetricDB.date <= today,
        ).count()
        water = db.query(WaterTrackingDB).filter(
            WaterTrackingDB.patient_id == patient_id,
            WaterTrackingDB.date == today,
        ).first()
        return {
            "water_ml_today": water.amount_ml if water else 0,
            "completed_meals_week": completed_week,
            "week_adherence_pct": week_adherence,
            "weight_logs_week": weight_logs,
            "streak_days": _meal_streak(patient_id, db, today),
        }

    def _claimed_keys(patient_id: int, db: Session) -> set:
        if PatientChallengeClaimDB is None:
            return set()
        rows = db.query(PatientChallengeClaimDB).filter(PatientChallengeClaimDB.patient_id == patient_id).all()
        return {(r.challenge_key, r.period_key) for r in rows}

    def _article_dict(article, include_content: bool = False) -> dict:
        payload = {
            "id": article.id,
            "title": article.title,
            "excerpt": article.excerpt or "",
            "category": article.category or "Nutrición",
            "author": article.author or "NutriData",
            "image": article.image,
            "published_at": article.published_at,
            "date": article.published_at,
        }
        if include_content:
            payload["content"] = article.content or ""
        return payload

    def _patient_tags(patient) -> List[str]:
        tags = []
        raw = " ".join([
            str(getattr(patient, "condiciones_medicas", "") or ""),
            str(getattr(patient, "objetivos_salud", "") or ""),
            str(getattr(patient, "programa_eps", "") or ""),
        ]).lower()
        for tag, keywords in CONDITION_ARTICLE_KEYWORDS.items():
            if any(k in raw for k in keywords):
                tags.append(tag)
        if not tags:
            tags.append("general")
        return tags

    # ── Retos y logros ──

    @app.get("/api/patient/{patient_id}/challenges")
    def get_patient_challenges(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        today = today_co()
        metrics = _metrics(patient_id, db, today)
        claimed = _claimed_keys(patient_id, db)

        challenges = []
        total_points = 0
        for ch in _get_challenge_defs(db):
            current = metrics.get(ch["metric"], 0)
            target = ch["target"]
            progress_pct = min(100, int((current / target) * 100)) if target else 0
            completed = current >= target
            pkey = _period_key(ch, today)
            claimed_flag = (ch["key"], pkey) in claimed
            if claimed_flag:
                total_points += ch["points"]
            challenges.append({
                **ch,
                "current": current,
                "progress_pct": progress_pct,
                "completed": completed,
                "claimed": claimed_flag,
                "period_key": pkey,
            })

        achievements = []
        if AchievementDB is not None:
            rows = (
                db.query(AchievementDB)
                .filter(AchievementDB.patient_id == patient_id)
                .order_by(AchievementDB.achieved_date.desc())
                .limit(20)
                .all()
            )
            for a in rows:
                d = a.achieved_date
                achievements.append({
                    "id": a.id,
                    "title": a.title,
                    "description": a.description,
                    "achieved_date": d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d),
                    "icon": a.icon or "award",
                })

        return {
            "challenges": challenges,
            "streak_days": metrics["streak_days"],
            "total_points": total_points,
            "achievements": achievements,
            "metrics": metrics,
        }

    @app.post("/api/patient/{patient_id}/challenges/{challenge_key}/claim")
    def claim_patient_challenge(
        patient_id: int,
        challenge_key: str,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if PatientChallengeClaimDB is None:
            raise HTTPException(status_code=503, detail="Retos no disponibles")

        ch = next((c for c in _get_challenge_defs(db) if c["key"] == challenge_key), None)
        if not ch:
            raise HTTPException(status_code=404, detail="Reto no encontrado")

        today = today_co()
        metrics = _metrics(patient_id, db, today)
        if metrics.get(ch["metric"], 0) < ch["target"]:
            raise HTTPException(status_code=400, detail="Aún no completas este reto")

        pkey = _period_key(ch, today)
        existing = db.query(PatientChallengeClaimDB).filter(
            PatientChallengeClaimDB.patient_id == patient_id,
            PatientChallengeClaimDB.challenge_key == challenge_key,
            PatientChallengeClaimDB.period_key == pkey,
        ).first()
        if existing:
            return {"success": True, "already_claimed": True, "points": existing.points}

        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        claim = PatientChallengeClaimDB(
            patient_id=patient_id,
            challenge_key=challenge_key,
            period_key=pkey,
            points=ch["points"],
            claimed_at=ts,
        )
        db.add(claim)

        if AchievementDB is not None:
            db.add(
                AchievementDB(
                    patient_id=patient_id,
                    title=f"Reto: {ch['title']}",
                    description=ch["description"],
                    achieved_date=today,
                    icon=ch.get("icon", "award"),
                )
            )
        db.commit()
        return {"success": True, "points": ch["points"], "title": ch["title"]}

    # ── Educación nutricional ──

    @app.get("/api/patient/{patient_id}/learn")
    def get_patient_learn_content(
        patient_id: int,
        search: Optional[str] = None,
        limit: int = 24,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        patient = _require_patient(patient_id, current_user, db)
        if ArticleDB is None:
            return {"articles": [], "recommended_tags": [], "featured": []}

        tags = _patient_tags(patient)
        query = db.query(ArticleDB).filter(ArticleDB.is_published == True)
        if search:
            like = f"%{search}%"
            from sqlalchemy import or_
            query = query.filter(or_(ArticleDB.title.like(like), ArticleDB.excerpt.like(like), ArticleDB.category.like(like)))

        articles = query.order_by(ArticleDB.published_at.desc(), ArticleDB.id.desc()).limit(max(1, min(limit, 100))).all()

        scored = []
        for art in articles:
            text_blob = f"{art.title} {art.excerpt or ''} {art.category or ''}".lower()
            score = 0
            matched = []
            art_conditions = getattr(art, "clinical_conditions", None)
            if art_conditions:
                if isinstance(art_conditions, str):
                    try:
                        art_conditions = json.loads(art_conditions)
                    except Exception:
                        art_conditions = []
                for tag in tags:
                    if tag in (art_conditions or []):
                        score += 8
                        matched.append(tag)
            for tag in tags:
                for kw in CONDITION_ARTICLE_KEYWORDS.get(tag, []):
                    if kw in text_blob:
                        score += 2
                        matched.append(tag)
                        break
            if art.category and art.category.lower() in text_blob:
                score += 1
            scored.append((score, art, list(set(matched))))

        scored.sort(key=lambda x: (-x[0], -(x[1].id or 0)))
        featured = [_article_dict(a) | {"matched_tags": m, "relevance_score": s} for s, a, m in scored[:6]]
        all_items = [_article_dict(a) | {"matched_tags": m, "relevance_score": s} for s, a, m in scored]

        categories = sorted({a.category for a in articles if a.category})

        return {
            "recommended_tags": tags,
            "categories": categories,
            "featured": featured,
            "articles": all_items,
            "patient_conditions": getattr(patient, "condiciones_medicas", None),
        }

    @app.get("/api/patient/{patient_id}/learn/{article_id}")
    def get_patient_learn_article(
        patient_id: int,
        article_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if ArticleDB is None:
            raise HTTPException(status_code=404, detail="Artículo no encontrado")
        article = db.query(ArticleDB).filter(ArticleDB.id == article_id, ArticleDB.is_published == True).first()
        if not article:
            raise HTTPException(status_code=404, detail="Artículo no encontrado")
        related = (
            db.query(ArticleDB)
            .filter(ArticleDB.is_published == True, ArticleDB.id != article_id, ArticleDB.category == article.category)
            .limit(3)
            .all()
        )
        payload = _article_dict(article, include_content=True)
        payload["related"] = [_article_dict(r) for r in related]
        return payload

    # ── Programa EPS ──

    @app.get("/api/patient/{patient_id}/program")
    def get_patient_program(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        patient = _require_patient(patient_id, current_user, db)
        today = today_co()
        metrics = _metrics(patient_id, db, today)

        org_info = None
        if OrganizationMemberDB is not None and OrganizationDB is not None:
            member = db.query(OrganizationMemberDB).filter(OrganizationMemberDB.user_id == patient_id).first()
            if member:
                org = db.query(OrganizationDB).filter(OrganizationDB.id == member.organization_id).first()
                if org:
                    benefit = org.benefit_description or org.benefit_type or "Beneficio activo"
                    if org.benefit_type == "descuento" and org.benefit_value:
                        benefit = f"Descuento {org.benefit_value}%"
                    org_info = {
                        "id": org.id,
                        "name": org.name,
                        "code": org.code,
                        "eps_program": org.eps_program,
                        "benefit_label": benefit,
                        "status": member.status,
                    }

        tomorrow = today + timedelta(days=1)
        next_apt = (
            db.query(AppointmentDB)
            .filter(
                AppointmentDB.patient_id == patient_id,
                AppointmentDB.status != "cancelada",
                AppointmentDB.date >= today,
            )
            .order_by(AppointmentDB.date.asc(), AppointmentDB.id.asc())
            .first()
        )

        active_plan = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.patient_id == patient_id,
            PatientMealPlanDB.status == "active",
        ).first()
        plan_name = None
        if active_plan:
            plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
            plan_name = plan.name if plan else "Plan activo"

        bio = getattr(patient, "examenes_bioquimicos", None) or {}
        if isinstance(bio, str):
            try:
                bio = json.loads(bio)
            except Exception:
                bio = {}
        last_bio_date = None
        history = bio.get("history") if isinstance(bio, dict) else None
        if isinstance(history, list) and history:
            last_bio_date = history[-1].get("date") if isinstance(history[-1], dict) else None

        pending_controls = []
        if not last_bio_date:
            pending_controls.append({"type": "bioquimicos", "label": "Control bioquímico pendiente", "priority": "high"})
        if metrics["week_adherence_pct"] < 60:
            pending_controls.append({"type": "adherence", "label": "Mejorar adherencia al plan", "priority": "medium"})
        if not next_apt:
            pending_controls.append({"type": "appointment", "label": "Agendar próxima consulta", "priority": "medium"})

        return {
            "programa_eps": getattr(patient, "programa_eps", None) or (org_info or {}).get("eps_program"),
            "organization": org_info,
            "plan_name": plan_name,
            "adherence_week_pct": metrics["week_adherence_pct"],
            "streak_days": metrics["streak_days"],
            "last_bioquimicos_date": last_bio_date,
            "next_appointment": {
                "id": next_apt.id,
                "date": str(next_apt.date),
                "time": next_apt.time,
                "type": next_apt.type,
                "status": next_apt.status,
            } if next_apt else None,
            "pending_controls": pending_controls,
            "compliance_status": "on_track" if metrics["week_adherence_pct"] >= 70 else "needs_attention",
        }

    # ── Hábitos ──

    @app.get("/api/patient/{patient_id}/habits/today")
    def get_patient_habits_today(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        today = today_co()
        today_str = today.strftime("%Y-%m-%d")

        water = db.query(WaterTrackingDB).filter(
            WaterTrackingDB.patient_id == patient_id,
            WaterTrackingDB.date == today,
        ).first()

        habit = None
        if PatientHabitLogDB is not None:
            habit = db.query(PatientHabitLogDB).filter(
                PatientHabitLogDB.patient_id == patient_id,
                PatientHabitLogDB.date == today_str,
            ).first()

        week_start = _week_start(today)
        week_habits = []
        if PatientHabitLogDB is not None:
            week_habits = (
                db.query(PatientHabitLogDB)
                .filter(
                    PatientHabitLogDB.patient_id == patient_id,
                    PatientHabitLogDB.date >= week_start.strftime("%Y-%m-%d"),
                )
                .order_by(PatientHabitLogDB.date.asc())
                .all()
            )

        return {
            "date": today_str,
            "water": {
                "amount_ml": water.amount_ml if water else 0,
                "target_ml": water.target_ml if water else 2500,
                "percentage": int(((water.amount_ml if water else 0) / (water.target_ml if water else 2500)) * 100),
            },
            "habits": {
                "sleep_hours": habit.sleep_hours if habit else None,
                "exercise_minutes": habit.exercise_minutes if habit else 0,
                "stress_level": habit.stress_level if habit else None,
                "digestion_notes": habit.digestion_notes if habit else None,
                "mood": habit.mood if habit else None,
            },
            "week_summary": {
                "days_logged": len(week_habits),
                "avg_sleep": round(sum(h.sleep_hours or 0 for h in week_habits) / len(week_habits), 1) if week_habits else None,
                "total_exercise_minutes": sum(h.exercise_minutes or 0 for h in week_habits),
            },
        }

    @app.put("/api/patient/{patient_id}/habits/today")
    def update_patient_habits_today(
        patient_id: int,
        payload: HabitUpdateBody,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if PatientHabitLogDB is None:
            raise HTTPException(status_code=503, detail="Hábitos no disponibles")

        today_str = today_co().strftime("%Y-%m-%d")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = db.query(PatientHabitLogDB).filter(
            PatientHabitLogDB.patient_id == patient_id,
            PatientHabitLogDB.date == today_str,
        ).first()
        if not row:
            row = PatientHabitLogDB(patient_id=patient_id, date=today_str, updated_at=ts)
            db.add(row)

        if payload.sleep_hours is not None:
            row.sleep_hours = float(payload.sleep_hours)
        if payload.exercise_minutes is not None:
            row.exercise_minutes = payload.exercise_minutes
        if payload.stress_level is not None:
            row.stress_level = payload.stress_level
        if payload.digestion_notes is not None:
            row.digestion_notes = payload.digestion_notes
        if payload.mood is not None:
            row.mood = payload.mood
        row.updated_at = ts
        db.commit()
        return {"success": True}

    # ── Preferencias de recordatorios ──

    def _default_prefs(patient_id: int) -> dict:
        return {
            "patient_id": patient_id,
            "meal_reminders": DEFAULT_MEAL_REMINDERS,
            "whatsapp_enabled": False,
            "email_enabled": True,
            "push_enabled": True,
            "weekly_report": True,
            "tips_enabled": True,
        }

    @app.get("/api/patient/{patient_id}/reminder-preferences")
    def get_reminder_preferences(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if PatientReminderPrefsDB is None:
            return _default_prefs(patient_id)
        row = db.query(PatientReminderPrefsDB).filter(PatientReminderPrefsDB.patient_id == patient_id).first()
        if not row:
            return _default_prefs(patient_id)
        return {
            "patient_id": patient_id,
            "meal_reminders": row.meal_reminders if isinstance(row.meal_reminders, dict) else DEFAULT_MEAL_REMINDERS,
            "whatsapp_enabled": bool(row.whatsapp_enabled),
            "email_enabled": bool(row.email_enabled),
            "push_enabled": bool(row.push_enabled),
            "weekly_report": bool(row.weekly_report),
            "tips_enabled": bool(row.tips_enabled),
            "updated_at": row.updated_at,
        }

    @app.put("/api/patient/{patient_id}/reminder-preferences")
    def update_reminder_preferences(
        patient_id: int,
        payload: ReminderPrefsUpdate,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        patient = _require_patient(patient_id, current_user, db)
        if PatientReminderPrefsDB is None:
            raise HTTPException(status_code=503, detail="Preferencias no disponibles")

        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = db.query(PatientReminderPrefsDB).filter(PatientReminderPrefsDB.patient_id == patient_id).first()
        if not row:
            row = PatientReminderPrefsDB(
                patient_id=patient_id,
                meal_reminders=DEFAULT_MEAL_REMINDERS.copy(),
                updated_at=ts,
            )
            db.add(row)

        if payload.meal_reminders is not None:
            row.meal_reminders = payload.meal_reminders
        if payload.whatsapp_enabled is not None:
            row.whatsapp_enabled = payload.whatsapp_enabled
        if payload.email_enabled is not None:
            row.email_enabled = payload.email_enabled
        if payload.push_enabled is not None:
            row.push_enabled = payload.push_enabled
        if payload.weekly_report is not None:
            row.weekly_report = payload.weekly_report
        if payload.tips_enabled is not None:
            row.tips_enabled = payload.tips_enabled
        row.updated_at = ts
        db.commit()

        whatsapp_sent = False
        if payload.whatsapp_enabled and send_whatsapp_notification and patient.telefono:
            msg = (
                f"Hola {patient.nombres or 'paciente'}, activaste recordatorios NutriData por WhatsApp. "
                "Te avisaremos sobre comidas, citas y consejos de tu plan."
            )
            whatsapp_sent = bool(send_whatsapp_notification(patient.telefono, msg))

        return {"success": True, "whatsapp_confirmation_sent": whatsapp_sent}

    @app.post("/api/patient/{patient_id}/reminders/send-meal-nudge")
    def send_meal_nudge(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        """Recordatorio inmediato (in-app + WhatsApp si está activo)."""
        patient = _require_patient(patient_id, current_user, db)
        prefs = get_reminder_preferences(patient_id, db, current_user)

        title = "Recordatorio de comida"
        description = "No olvides registrar tu próxima comida en NutriData."

        if NotificationDB is not None and prefs.get("push_enabled", True):
            db.add(NotificationDB(user_id=patient_id, type="reminder", title=title, description=description, read=False))
            db.commit()

        whatsapp_sent = False
        if prefs.get("whatsapp_enabled") and send_whatsapp_notification and patient.telefono:
            whatsapp_sent = bool(send_whatsapp_notification(patient.telefono, f"NutriData: {description}"))

        return {"success": True, "whatsapp_sent": whatsapp_sent}
