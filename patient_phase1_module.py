"""Fase 1 — panel paciente: adherencia, centro de notificaciones."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Callable, List, Optional

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session


REMINDER_TITLES = {
    "no_meal_logs": "Registra tus comidas",
    "low_adherence": "Adherencia baja",
    "appointment_24h": "Recordatorio de cita",
    "appointment_reminder": "Recordatorio de cita",
    "reminder": "Recordatorio",
}


def register_patient_phase1_routes(app, deps: dict):
    get_db = deps["get_db"]
    get_current_user = deps["get_current_user"]
    authorize_patient_access = deps["authorize_patient_access"]
    UserDB = deps["UserDB"]
    MealPlanDB = deps["MealPlanDB"]
    PatientMealPlanDB = deps["PatientMealPlanDB"]
    MealTrackingDB = deps["MealTrackingDB"]
    ProgressMetricDB = deps["ProgressMetricDB"]
    AppointmentDB = deps["AppointmentDB"]
    NotificationDB = deps.get("NotificationDB")
    today_co: Callable = deps["today_co"]
    now_co: Callable = deps["now_co"]
    calculate_weekly_adherence = deps.get("calculate_weekly_adherence")
    calculate_previous_week_adherence = deps.get("calculate_previous_week_adherence")

    def _require_patient(patient_id: int, current_user, db: Session):
        authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        return patient

    def _adherence_for_period(patient_id: int, db: Session, start: date, end: date) -> dict:
        base = db.query(MealTrackingDB).filter(
            MealTrackingDB.patient_id == patient_id,
            MealTrackingDB.date >= start,
            MealTrackingDB.date <= end,
        )
        total = base.count()
        completed = base.filter(MealTrackingDB.completed == 1).count()
        pct = int((completed / total) * 100) if total else 0
        return {"total_meals": total, "completed_meals": completed, "adherence_pct": pct}

    def _last_meal_log_date(patient_id: int, db: Session) -> Optional[date]:
        row = (
            db.query(MealTrackingDB.date)
            .filter(MealTrackingDB.patient_id == patient_id)
            .order_by(MealTrackingDB.date.desc(), MealTrackingDB.id.desc())
            .first()
        )
        return row[0] if row else None

    def _daily_series(patient_id: int, db: Session, days: int = 7) -> List[dict]:
        today = today_co()
        series = []
        for offset in range(days - 1, -1, -1):
            d = today - timedelta(days=offset)
            stats = _adherence_for_period(patient_id, db, d, d)
            series.append(
                {
                    "date": d.strftime("%Y-%m-%d"),
                    "label": d.strftime("%d/%m"),
                    "adherence_pct": stats["adherence_pct"],
                    "completed_meals": stats["completed_meals"],
                    "total_meals": stats["total_meals"],
                }
            )
        return series

    def _next_action(patient, db: Session, today: date) -> dict:
        last_log = _last_meal_log_date(patient.id, db)
        days_without = (today - last_log).days if last_log else None

        today_stats = _adherence_for_period(patient.id, db, today, today)
        pending_today = max(0, today_stats["total_meals"] - today_stats["completed_meals"])

        if pending_today > 0:
            return {
                "type": "log_meals",
                "label": f"Te falta registrar {pending_today} comida{'s' if pending_today > 1 else ''} de hoy",
                "path": "/patient/meals",
            }

        if days_without is not None and days_without >= 2:
            return {
                "type": "return_logging",
                "label": f"Llevas {days_without} días sin registrar comidas",
                "path": "/patient/meals",
            }

        last_metric = (
            db.query(ProgressMetricDB)
            .filter(ProgressMetricDB.patient_id == patient.id)
            .order_by(ProgressMetricDB.date.desc())
            .first()
        )
        if last_metric:
            days_since_weight = (today - last_metric.date).days
            if days_since_weight >= 7:
                return {
                    "type": "log_weight",
                    "label": "Registra tu peso esta semana",
                    "path": "/patient/progress",
                }
        elif patient.peso_actual:
            return {
                "type": "log_weight",
                "label": "Registra tu peso para ver tu progreso",
                "path": "/patient/progress",
            }

        next_apt = (
            db.query(AppointmentDB)
            .filter(
                AppointmentDB.patient_id == patient.id,
                AppointmentDB.date >= today,
                AppointmentDB.status != "cancelada",
            )
            .order_by(AppointmentDB.date.asc(), AppointmentDB.time.asc())
            .first()
        )
        if next_apt and (next_apt.date - today).days <= 3:
            return {
                "type": "appointment",
                "label": f"Tienes cita el {next_apt.date.strftime('%d/%m')} a las {next_apt.time}",
                "path": "/patient/appointments",
            }

        week_pct = calculate_weekly_adherence(patient.id, db) if calculate_weekly_adherence else 0
        if week_pct >= 80:
            return {
                "type": "on_track",
                "label": "¡Vas muy bien esta semana! Sigue así",
                "path": "/patient/adherence",
            }

        return {
            "type": "view_plan",
            "label": "Revisa tu plan nutricional de hoy",
            "path": "/patient/my-plan",
        }

    def _adherence_level(pct: int) -> str:
        if pct >= 80:
            return "excellent"
        if pct >= 60:
            return "good"
        if pct >= 40:
            return "fair"
        return "low"

    def _adherence_message(pct: int) -> str:
        if pct >= 80:
            return "Excelente adherencia. Mantén el ritmo."
        if pct >= 60:
            return "Buen avance. Intenta registrar todas las comidas."
        if pct >= 40:
            return "Puedes mejorar. Registra cada comida del plan."
        if pct > 0:
            return "Adherencia baja. Tu nutricionista puede ayudarte."
        return "Aún no hay registros esta semana. Empieza hoy."

    @app.get("/api/patient/{patient_id}/adherence")
    def get_patient_adherence(
        patient_id: int,
        days: int = 7,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        patient = _require_patient(patient_id, current_user, db)
        today = today_co()
        days = max(3, min(days, 30))

        week_start = today - timedelta(days=today.weekday())
        week_stats = _adherence_for_period(patient_id, db, week_start, today)
        today_stats = _adherence_for_period(patient_id, db, today, today)

        week_pct = calculate_weekly_adherence(patient_id, db) if calculate_weekly_adherence else week_stats["adherence_pct"]
        prev_week_pct = (
            calculate_previous_week_adherence(patient_id, db)
            if calculate_previous_week_adherence
            else week_pct
        )

        last_log = _last_meal_log_date(patient_id, db)
        days_without = (today - last_log).days if last_log else None

        active_plan = (
            db.query(PatientMealPlanDB)
            .filter(PatientMealPlanDB.patient_id == patient_id, PatientMealPlanDB.status == "active")
            .first()
        )
        plan_name = None
        if active_plan:
            plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
            plan_name = plan.name if plan else "Plan activo"

        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "period_days": days,
            "plan_name": plan_name,
            "summary": {
                "today_pct": today_stats["adherence_pct"],
                "week_pct": week_pct,
                "previous_week_pct": prev_week_pct,
                "change": week_pct - prev_week_pct,
                "level": _adherence_level(week_pct),
                "message": _adherence_message(week_pct),
                "days_without_logs": days_without,
                "completed_meals_week": week_stats["completed_meals"],
                "total_meals_week": week_stats["total_meals"],
            },
            "daily_series": _daily_series(patient_id, db, days),
            "next_action": _next_action(patient, db, today),
            "tips": [
                "Marca cada comida en cuanto la completes.",
                "Si te sales del plan, regístralo igual — ayuda a tu nutricionista.",
                "La adherencia se calcula con las comidas de tu plan activo.",
            ],
        }

    def _format_notification_row(row) -> dict:
        title = row.title or "Notificación"
        if title in REMINDER_TITLES:
            title = REMINDER_TITLES[title]
        elif title.replace("_", " ") == title and len(title) < 40:
            pass
        else:
            title = REMINDER_TITLES.get(row.type, title.replace("_", " ").capitalize())

        created = row.created_at
        if hasattr(created, "strftime"):
            created_str = created.strftime("%Y-%m-%d %H:%M:%S")
            date_str = created.strftime("%Y-%m-%d")
        else:
            created_str = str(created)[:19] if created else ""
            date_str = created_str[:10] if created_str else today_co().strftime("%Y-%m-%d")

        return {
            "id": str(row.id),
            "source": "stored",
            "type": row.type or "general",
            "title": title,
            "message": row.description or "",
            "date": date_str,
            "created_at": created_str,
            "priority": "high" if row.type in ("appointment", "appointment_reminder") else "medium",
            "read": bool(row.read),
        }

    def _computed_notifications(patient_id: int, db: Session, today: date) -> List[dict]:
        items: List[dict] = []

        next_appointment = (
            db.query(AppointmentDB)
            .filter(
                AppointmentDB.patient_id == patient_id,
                AppointmentDB.date >= today,
                AppointmentDB.status != "cancelada",
            )
            .order_by(AppointmentDB.date.asc())
            .first()
        )
        if next_appointment:
            days_until = (next_appointment.date - today).days
            if days_until <= 2:
                items.append(
                    {
                        "id": f"computed_apt_{next_appointment.id}",
                        "source": "computed",
                        "type": "appointment",
                        "title": "Cita hoy" if days_until == 0 else "Próxima cita",
                        "message": f"Tienes una cita {next_appointment.date.strftime('%d/%m')} a las {next_appointment.time}",
                        "date": next_appointment.date.strftime("%Y-%m-%d"),
                        "created_at": today.strftime("%Y-%m-%d"),
                        "priority": "high" if days_until == 0 else "medium",
                        "read": False,
                    }
                )

        last_metric = (
            db.query(ProgressMetricDB)
            .filter(ProgressMetricDB.patient_id == patient_id)
            .order_by(ProgressMetricDB.date.desc())
            .first()
        )
        if last_metric:
            days_since = (today - last_metric.date).days
            if days_since >= 7:
                items.append(
                    {
                        "id": "computed_weight",
                        "source": "computed",
                        "type": "reminder",
                        "title": "Registra tu peso",
                        "message": f"Han pasado {days_since} días desde tu último registro",
                        "date": today.strftime("%Y-%m-%d"),
                        "created_at": today.strftime("%Y-%m-%d"),
                        "priority": "medium",
                        "read": False,
                    }
                )

        return items

    @app.get("/api/patient/{patient_id}/notifications/inbox")
    def get_patient_notifications_inbox(
        patient_id: int,
        unread_only: bool = False,
        limit: int = 50,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        today = today_co()
        limit = max(1, min(limit, 100))
        stored: List[dict] = []

        if NotificationDB is not None:
            q = db.query(NotificationDB).filter(NotificationDB.user_id == patient_id)
            if unread_only:
                q = q.filter(NotificationDB.read == False)  # noqa: E712
            rows = q.order_by(NotificationDB.created_at.desc()).limit(limit).all()
            stored = [_format_notification_row(r) for r in rows]

        computed = _computed_notifications(patient_id, db, today)

        # Evitar duplicar citas/peso si ya hay stored similar hoy
        stored_keys = {(n["type"], (n["message"] or "")[:40]) for n in stored}
        for c in computed:
            key = (c["type"], c["message"][:40])
            if key not in stored_keys:
                stored.append(c)

        stored.sort(key=lambda n: n.get("created_at") or n.get("date") or "", reverse=True)
        unread_count = sum(1 for n in stored if not n.get("read"))

        return {
            "count": len(stored),
            "unread_count": unread_count,
            "notifications": stored[:limit],
        }

    @app.patch("/api/patient/{patient_id}/notifications/{notification_id}/read")
    def mark_patient_notification_read(
        patient_id: int,
        notification_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        if NotificationDB is None:
            raise HTTPException(status_code=404, detail="Notificación no encontrada")

        row = (
            db.query(NotificationDB)
            .filter(NotificationDB.id == notification_id, NotificationDB.user_id == patient_id)
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Notificación no encontrada")

        row.read = True
        db.commit()
        return {"success": True, "id": notification_id}

    @app.patch("/api/patient/{patient_id}/notifications/read-all")
    def mark_all_patient_notifications_read(
        patient_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_patient(patient_id, current_user, db)
        updated = 0
        if NotificationDB is not None:
            rows = db.query(NotificationDB).filter(
                NotificationDB.user_id == patient_id,
                NotificationDB.read == False,  # noqa: E712
            ).all()
            for row in rows:
                row.read = True
                updated += 1
            db.commit()
        return {"success": True, "updated": updated}
