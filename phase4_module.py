"""Fase 4 — recordatorios, panel EPS y analítica avanzada."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Callable, List, Optional

from fastapi import Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Session


FollowUpTaskDB = None

TASK_TYPES = {
    "call": "Llamada de seguimiento",
    "appointment": "Agendar cita",
    "bioquimicos": "Control bioquímico",
    "menu_review": "Revisar menú",
    "adherence": "Seguimiento adherencia",
    "custom": "Personalizada",
}

TASK_STATUSES = {"pending", "done", "cancelled"}


class FollowUpCreate(BaseModel):
    patient_id: int
    task_type: str = "custom"
    title: str = Field(min_length=2, max_length=200)
    description: Optional[str] = None
    due_date: Optional[str] = None


class FollowUpUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None


def register_phase4_models(Base):
    global FollowUpTaskDB

    class _FollowUpTaskDB(Base):
        __tablename__ = "follow_up_tasks"
        id = Column(Integer, primary_key=True, index=True)
        nutritionist_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        task_type = Column(String(40), default="custom")
        title = Column(String(200), nullable=False)
        description = Column(Text, nullable=True)
        due_date = Column(String(20), nullable=True)
        status = Column(String(20), default="pending")
        source = Column(String(40), default="manual")
        created_at = Column(String(50), nullable=True)
        completed_at = Column(String(50), nullable=True)

    FollowUpTaskDB = _FollowUpTaskDB
    return FollowUpTaskDB


def register_phase4_routes(app, deps: dict):
    get_db = deps["get_db"]
    get_current_user = deps["get_current_user"]
    authorize_patient_access = deps.get("authorize_patient_access")
    UserDB = deps["UserDB"]
    MealPlanDB = deps["MealPlanDB"]
    PatientMealPlanDB = deps["PatientMealPlanDB"]
    MealTrackingDB = deps["MealTrackingDB"]
    ProgressMetricDB = deps["ProgressMetricDB"]
    AppointmentDB = deps["AppointmentDB"]
    NotificationDB = deps.get("NotificationDB")
    OrganizationMemberDB = deps.get("OrganizationMemberDB")
    AdminProfileDB = deps.get("AdminProfileDB")
    today_co: Callable = deps["today_co"]
    now_co: Callable = deps["now_co"]

    def _require_admin(current_user):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")

    def _patient_ids(db: Session, current_user) -> List[int]:
        q = db.query(UserDB.id).filter(UserDB.role == "patient", UserDB.status == "activo")
        if current_user.role == "admin":
            q = q.filter(UserDB.nutritionist_id == current_user.id)
        return [r.id for r in q.all()]

    def _patients_scope(db: Session, current_user) -> List:
        ids = _patient_ids(db, current_user)
        if not ids:
            return []
        return db.query(UserDB).filter(UserDB.id.in_(ids)).all()

    def _last_meal_date(patient_id: int, db: Session) -> Optional[date]:
        row = (
            db.query(MealTrackingDB.date)
            .filter(MealTrackingDB.patient_id == patient_id)
            .order_by(MealTrackingDB.date.desc())
            .first()
        )
        return row[0] if row else None

    def _adherence_pct(patient_id: int, db: Session, days: int = 7) -> int:
        end = today_co()
        start = end - timedelta(days=days - 1)
        base = db.query(MealTrackingDB).filter(
            MealTrackingDB.patient_id == patient_id,
            MealTrackingDB.date >= start,
            MealTrackingDB.date <= end,
        )
        total = base.count()
        done = base.filter(MealTrackingDB.completed == 1).count()
        return int((done / total) * 100) if total else 0

    def _abandonment_score(patient, db: Session, today: date) -> dict:
        factors = []
        score = 0
        last_log = _last_meal_date(patient.id, db)
        days_without = (today - last_log).days if last_log else 999
        if days_without >= 5:
            score += 35
            factors.append(f"Sin logs hace {days_without} días")
        elif days_without >= 3:
            score += 20
            factors.append(f"Sin logs hace {days_without} días")

        adherence = _adherence_pct(patient.id, db)
        if adherence < 40:
            score += 30
            factors.append(f"Adherencia muy baja ({adherence}%)")
        elif adherence < 60:
            score += 15
            factors.append(f"Adherencia baja ({adherence}%)")

        last_apt = (
            db.query(AppointmentDB)
            .filter(AppointmentDB.patient_id == patient.id, AppointmentDB.status != "cancelada")
            .order_by(AppointmentDB.date.desc())
            .first()
        )
        if last_apt:
            days_since_apt = (today - last_apt.date).days
            if days_since_apt > 45:
                score += 20
                factors.append(f"Sin cita reciente ({days_since_apt} días)")
        else:
            score += 15
            factors.append("Sin citas registradas")

        active = (
            db.query(PatientMealPlanDB)
            .filter(PatientMealPlanDB.patient_id == patient.id, PatientMealPlanDB.status == "active")
            .first()
        )
        if not active:
            score += 20
            factors.append("Sin plan activo")

        score = min(100, score)
        level = "high" if score >= 60 else "medium" if score >= 35 else "low"
        return {
            "score": score,
            "level": level,
            "factors": factors,
            "adherence_pct": adherence,
            "days_without_logs": days_without if days_without < 999 else None,
        }

    def _task_dict(task, patient=None) -> dict:
        payload = {
            "id": task.id,
            "patient_id": task.patient_id,
            "nutritionist_id": task.nutritionist_id,
            "task_type": task.task_type,
            "task_type_label": TASK_TYPES.get(task.task_type, task.task_type),
            "title": task.title,
            "description": task.description,
            "due_date": task.due_date,
            "status": task.status,
            "source": task.source,
            "created_at": task.created_at,
            "completed_at": task.completed_at,
        }
        if patient:
            payload["patient_name"] = f"{patient.nombres} {patient.apellidos}"
        return payload

    def _build_reminders_preview(db: Session, current_user):
        today = today_co()
        patients = _patients_scope(db, current_user)
        patient_reminders = []
        nutritionist_tasks = []

        for p in patients:
            last_log = _last_meal_date(p.id, db)
            days_without = (today - last_log).days if last_log else 999
            adherence = _adherence_pct(p.id, db)
            if days_without >= 3:
                patient_reminders.append({
                    "patient_id": p.id,
                    "patient_name": f"{p.nombres} {p.apellidos}",
                    "type": "no_meal_logs",
                    "message": f"Recordatorio: registra tus comidas ({days_without} días sin actividad)",
                })
            if adherence < 50:
                patient_reminders.append({
                    "patient_id": p.id,
                    "patient_name": f"{p.nombres} {p.apellidos}",
                    "type": "low_adherence",
                    "message": f"Tu adherencia esta semana es {adherence}%. ¿Necesitas ayuda con el plan?",
                })

            risk = _abandonment_score(p, db, today)
            if risk["score"] >= 60:
                nutritionist_tasks.append({
                    "patient_id": p.id,
                    "patient_name": f"{p.nombres} {p.apellidos}",
                    "type": "abandonment_risk",
                    "title": f"Contactar — riesgo de abandono ({risk['score']}%)",
                    "factors": risk["factors"],
                })

        tomorrow = today + timedelta(days=1)
        apt_q = db.query(AppointmentDB).filter(
            AppointmentDB.date == tomorrow,
            AppointmentDB.status != "cancelada",
        )
        if current_user.role == "admin":
            pids = _patient_ids(db, current_user)
            apt_q = apt_q.filter(AppointmentDB.patient_id.in_(pids)) if pids else apt_q.filter(AppointmentDB.id == -1)
        for apt in apt_q.all():
            pat = db.query(UserDB).filter(UserDB.id == apt.patient_id).first()
            if pat:
                patient_reminders.append({
                    "patient_id": pat.id,
                    "patient_name": f"{pat.nombres} {pat.apellidos}",
                    "type": "appointment_24h",
                    "message": f"Recordatorio: cita mañana a las {apt.time}",
                })

        return {
            "patient_notifications": patient_reminders,
            "suggested_tasks": nutritionist_tasks,
            "counts": {
                "patient_notifications": len(patient_reminders),
                "suggested_tasks": len(nutritionist_tasks),
            },
        }

    # ── Follow-up tasks ──

    @app.get("/api/nutritionist/follow-ups")
    def list_follow_ups(
        status: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_admin(current_user)
        if FollowUpTaskDB is None:
            return []
        q = db.query(FollowUpTaskDB).filter(FollowUpTaskDB.nutritionist_id == current_user.id)
        if status and status != "all":
            q = q.filter(FollowUpTaskDB.status == status)
        tasks = q.order_by(FollowUpTaskDB.due_date.asc(), FollowUpTaskDB.id.desc()).limit(100).all()
        result = []
        for t in tasks:
            p = db.query(UserDB).filter(UserDB.id == t.patient_id).first()
            result.append(_task_dict(t, p))
        return result

    @app.post("/api/nutritionist/follow-ups")
    def create_follow_up(
        body: FollowUpCreate,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_admin(current_user)
        if FollowUpTaskDB is None:
            raise HTTPException(status_code=500, detail="Modelo no disponible")
        if authorize_patient_access:
            authorize_patient_access(body.patient_id, current_user, db)
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        task = FollowUpTaskDB(
            nutritionist_id=current_user.id,
            patient_id=body.patient_id,
            task_type=body.task_type or "custom",
            title=body.title.strip(),
            description=body.description,
            due_date=body.due_date,
            status="pending",
            source="manual",
            created_at=ts,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        p = db.query(UserDB).filter(UserDB.id == task.patient_id).first()
        return _task_dict(task, p)

    @app.patch("/api/nutritionist/follow-ups/{task_id}")
    def update_follow_up(
        task_id: int,
        body: FollowUpUpdate,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_admin(current_user)
        task = db.query(FollowUpTaskDB).filter(
            FollowUpTaskDB.id == task_id,
            FollowUpTaskDB.nutritionist_id == current_user.id,
        ).first()
        if not task:
            raise HTTPException(status_code=404, detail="Tarea no encontrada")
        if body.title is not None:
            task.title = body.title.strip()
        if body.description is not None:
            task.description = body.description
        if body.due_date is not None:
            task.due_date = body.due_date
        if body.status is not None:
            if body.status not in TASK_STATUSES:
                raise HTTPException(status_code=400, detail="Estado inválido")
            task.status = body.status
            if body.status == "done":
                task.completed_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        db.refresh(task)
        p = db.query(UserDB).filter(UserDB.id == task.patient_id).first()
        return _task_dict(task, p)

    @app.delete("/api/nutritionist/follow-ups/{task_id}")
    def delete_follow_up(
        task_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_admin(current_user)
        task = db.query(FollowUpTaskDB).filter(
            FollowUpTaskDB.id == task_id,
            FollowUpTaskDB.nutritionist_id == current_user.id,
        ).first()
        if not task:
            raise HTTPException(status_code=404, detail="Tarea no encontrada")
        db.delete(task)
        db.commit()
        return {"success": True}

    # ── Recordatorios automáticos ──

    @app.get("/api/nutritionist/reminders/preview")
    def preview_automatic_reminders(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_admin(current_user)
        return _build_reminders_preview(db, current_user)

    @app.post("/api/nutritionist/reminders/run-automatic")
    def run_automatic_reminders(
        create_tasks: bool = True,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_admin(current_user)
        preview = _build_reminders_preview(db, current_user)
        sent_patient = 0
        created_tasks = 0
        ts = now_co()

        if NotificationDB is not None:
            for item in preview["patient_notifications"]:
                existing = (
                    db.query(NotificationDB)
                    .filter(
                        NotificationDB.user_id == item["patient_id"],
                        NotificationDB.type == "reminder",
                        NotificationDB.title.contains(item["type"]),
                        NotificationDB.created_at >= ts.replace(hour=0, minute=0, second=0, microsecond=0),
                    )
                    .first()
                )
                if existing:
                    continue
                db.add(
                    NotificationDB(
                        user_id=item["patient_id"],
                        type="reminder",
                        title={
                            "no_meal_logs": "Registra tus comidas",
                            "low_adherence": "Adherencia baja",
                            "appointment_24h": "Recordatorio de cita",
                        }.get(item["type"], "Recordatorio"),
                        description=item["message"],
                        read=False,
                        created_at=ts,
                    )
                )
                sent_patient += 1

        if create_tasks and FollowUpTaskDB is not None:
            due = (today_co() + timedelta(days=2)).strftime("%Y-%m-%d")
            for item in preview["suggested_tasks"]:
                dup = (
                    db.query(FollowUpTaskDB)
                    .filter(
                        FollowUpTaskDB.nutritionist_id == current_user.id,
                        FollowUpTaskDB.patient_id == item["patient_id"],
                        FollowUpTaskDB.source == "auto_abandonment",
                        FollowUpTaskDB.status == "pending",
                    )
                    .first()
                )
                if dup:
                    continue
                db.add(
                    FollowUpTaskDB(
                        nutritionist_id=current_user.id,
                        patient_id=item["patient_id"],
                        task_type="adherence",
                        title=item["title"],
                        description="; ".join(item.get("factors", [])),
                        due_date=due,
                        status="pending",
                        source="auto_abandonment",
                        created_at=ts.strftime("%Y-%m-%d %H:%M:%S"),
                    )
                )
                created_tasks += 1

        db.commit()
        return {
            "success": True,
            "notifications_sent": sent_patient,
            "tasks_created": created_tasks,
            "preview": preview["counts"],
        }

    # ── Panel EPS ──

    @app.get("/api/nutritionist/eps/dashboard")
    def eps_dashboard(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_admin(current_user)
        today = today_co()
        patients = _patients_scope(db, current_user)
        programs: dict = {}

        for p in patients:
            eps = (getattr(p, "programa_eps", None) or "Sin EPS/programa").strip() or "Sin EPS/programa"
            if eps not in programs:
                programs[eps] = {
                    "eps": eps,
                    "patient_count": 0,
                    "avg_adherence": [],
                    "at_risk": 0,
                    "with_bio": 0,
                    "with_mipress": 0,
                    "patients": [],
                }
            prog = programs[eps]
            prog["patient_count"] += 1
            adherence = _adherence_pct(p.id, db)
            prog["avg_adherence"].append(adherence)
            risk = _abandonment_score(p, db, today)
            if risk["score"] >= 35:
                prog["at_risk"] += 1

            bio_raw = getattr(p, "examenes_bioquimicos", None)
            has_bio = bool(bio_raw and isinstance(bio_raw, dict) and bio_raw.get("current"))
            if has_bio:
                prog["with_bio"] += 1
            dc = getattr(p, "datos_clinicos", None) or {}
            if isinstance(dc, dict) and dc.get("mipress_prescription"):
                prog["with_mipress"] += 1

            prog["patients"].append({
                "id": p.id,
                "name": f"{p.nombres} {p.apellidos}",
                "adherence_pct": adherence,
                "abandonment_score": risk["score"],
                "abandonment_level": risk["level"],
                "has_bio": has_bio,
            })

        rows = []
        for eps, data in sorted(programs.items(), key=lambda x: -x[1]["patient_count"]):
            adh = data["avg_adherence"]
            rows.append({
                "eps": data["eps"],
                "patient_count": data["patient_count"],
                "avg_adherence": int(sum(adh) / len(adh)) if adh else 0,
                "at_risk": data["at_risk"],
                "with_bio": data["with_bio"],
                "with_mipress": data["with_mipress"],
                "patients": sorted(data["patients"], key=lambda x: -x["abandonment_score"])[:20],
            })

        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "summary": {
                "total_programs": len(rows),
                "total_patients": len(patients),
                "patients_at_risk": sum(r["at_risk"] for r in rows),
            },
            "programs": rows,
        }

    # ── Analítica avanzada ──

    @app.get("/api/nutritionist/analytics/clinical-dashboard")
    def clinical_analytics_dashboard(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_admin(current_user)
        today = today_co()
        patients = _patients_scope(db, current_user)
        adherence_vals = []
        at_risk = 0
        on_track = 0
        weight_progress = []

        for p in patients:
            adh = _adherence_pct(p.id, db)
            adherence_vals.append(adh)
            risk = _abandonment_score(p, db, today)
            if risk["score"] >= 35:
                at_risk += 1
            if adh >= 80:
                on_track += 1
            if p.peso_actual and p.peso_objetivo and p.peso_inicial:
                try:
                    total = abs(p.peso_objetivo - p.peso_inicial)
                    done = abs(p.peso_actual - p.peso_inicial)
                    pct = int(min(100, (done / total) * 100)) if total else 0
                    weight_progress.append(pct)
                except Exception:
                    pass

        pending_tasks = 0
        if FollowUpTaskDB is not None:
            pending_tasks = (
                db.query(FollowUpTaskDB)
                .filter(FollowUpTaskDB.nutritionist_id == current_user.id, FollowUpTaskDB.status == "pending")
                .count()
            )

        week_start = today - timedelta(days=6)
        appointments_week = db.query(AppointmentDB).filter(
            AppointmentDB.date >= week_start,
            AppointmentDB.date <= today,
            AppointmentDB.status != "cancelada",
        )
        if current_user.role == "admin":
            pids = _patient_ids(db, current_user)
            appointments_week = appointments_week.filter(AppointmentDB.patient_id.in_(pids)) if pids else appointments_week.filter(AppointmentDB.id == -1)

        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "summary": {
                "total_patients": len(patients),
                "avg_adherence": int(sum(adherence_vals) / len(adherence_vals)) if adherence_vals else 0,
                "patients_on_track": on_track,
                "patients_at_risk": at_risk,
                "avg_weight_progress": int(sum(weight_progress) / len(weight_progress)) if weight_progress else 0,
                "pending_follow_ups": pending_tasks,
                "appointments_this_week": appointments_week.count(),
            },
        }

    @app.get("/api/nutritionist/analytics/abandonment-risk")
    def abandonment_risk_list(
        limit: int = 30,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_admin(current_user)
        today = today_co()
        patients = _patients_scope(db, current_user)
        ranked = []
        for p in patients:
            risk = _abandonment_score(p, db, today)
            ranked.append({
                "patient_id": p.id,
                "name": f"{p.nombres} {p.apellidos}",
                "programa_eps": getattr(p, "programa_eps", None),
                **risk,
            })
        ranked.sort(key=lambda x: -x["score"])
        return ranked[: max(1, min(limit, 100))]

    @app.get("/api/nutritionist/analytics/monthly-report")
    def monthly_report(
        format: str = "json",
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_admin(current_user)
        dashboard = clinical_analytics_dashboard(db=db, current_user=current_user)
        abandonment = abandonment_risk_list(limit=15, db=db, current_user=current_user)
        eps = eps_dashboard(db=db, current_user=current_user)

        payload = {
            "report_month": now_co().strftime("%Y-%m"),
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "clinical_summary": dashboard["summary"],
            "top_abandonment_risk": abandonment[:10],
            "eps_summary": eps["summary"],
            "eps_programs": [{"eps": p["eps"], "patients": p["patient_count"], "avg_adherence": p["avg_adherence"], "at_risk": p["at_risk"]} for p in eps["programs"][:10]],
        }

        if format != "pdf":
            return payload

        from io import BytesIO
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from reportlab.lib import colors
        from pdf_utils import draw_pdf_signature_block, get_nutritionist_signatory, make_verification_code

        buffer = BytesIO()
        width, height = A4
        c = canvas.Canvas(buffer, pagesize=A4)
        primary = colors.HexColor("#7a9b76")
        y = height - 50
        c.setFillColor(primary)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, y, f"Reporte mensual clínico — {payload['report_month']}")
        y -= 30
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10)
        s = payload["clinical_summary"]
        lines = [
            f"Pacientes activos: {s['total_patients']}",
            f"Adherencia promedio: {s['avg_adherence']}%",
            f"En meta (≥80%): {s['patients_on_track']}",
            f"En riesgo: {s['patients_at_risk']}",
            f"Progreso de peso prom.: {s['avg_weight_progress']}%",
            f"Citas esta semana: {s['appointments_this_week']}",
            f"Seguimientos pendientes: {s['pending_follow_ups']}",
        ]
        for line in lines:
            c.drawString(50, y, line)
            y -= 16
        y -= 10
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, y, "Top riesgo de abandono")
        y -= 18
        c.setFont("Helvetica", 9)
        for row in payload["top_abandonment_risk"][:8]:
            if y < 130:
                break
            c.drawString(50, y, f"{row['name'][:35]} — score {row['score']} ({row['level']})")
            y -= 12

        generated_at_dt = now_co()
        generated_at = generated_at_dt.strftime("%Y-%m-%d %H:%M COT")
        nutri_name, license_to, specialty = get_nutritionist_signatory(db, current_user, AdminProfileDB)
        code = make_verification_code(current_user.id, "monthly_report", generated_at_dt)
        draw_pdf_signature_block(
            c, x=50, y=95, width=width - 100,
            nutritionist_name=nutri_name, license_to=license_to, specialty=specialty,
            generated_at=generated_at, verification_code=code, doc_label="Reporte mensual",
        )
        c.save()
        buffer.seek(0)
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=reporte_mensual_{payload['report_month']}.pdf"},
        )
