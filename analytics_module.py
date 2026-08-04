"""Centro de adherencia — analytics dashboard y exportación."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional, List, Callable

from fastapi import Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session


PLAN_TIPO_LABELS = {
    "adulto": "Adulto",
    "pediatria": "Pediatría",
    "gestante": "Gestante",
    "gestante_adolescente": "Gestante adolescente",
    "hospitalizado": "Hospitalizado",
    "geriatrico": "Geriátrico",
    "deportista": "Deportista",
}


def register_analytics_routes(app, deps: dict):
    AdminProfileDB = deps.get("AdminProfileDB")
    get_db = deps["get_db"]
    get_current_user = deps["get_current_user"]
    UserDB = deps["UserDB"]
    MealPlanDB = deps["MealPlanDB"]
    PatientMealPlanDB = deps["PatientMealPlanDB"]
    MealTrackingDB = deps["MealTrackingDB"]
    ProgressMetricDB = deps["ProgressMetricDB"]
    OrganizationDB = deps.get("OrganizationDB")
    OrganizationMemberDB = deps.get("OrganizationMemberDB")
    get_initial_weight = deps["get_initial_weight"]
    today_co = deps["today_co"]
    now_co = deps["now_co"]

    def calculate_adherence_for_period(patient_id: int, db: Session, start_date: date, end_date: date) -> dict:
        base_q = db.query(MealTrackingDB).filter(
            MealTrackingDB.patient_id == patient_id,
            MealTrackingDB.date >= start_date,
            MealTrackingDB.date <= end_date,
        )
        total = base_q.count()
        completed = base_q.filter(MealTrackingDB.completed == 1).count()
        pct = int((completed / total) * 100) if total else 0
        return {"total_meals": total, "completed_meals": completed, "adherence_pct": pct}

    def get_last_meal_activity_date(patient_id: int, db: Session) -> Optional[date]:
        row = (
            db.query(MealTrackingDB.date)
            .filter(MealTrackingDB.patient_id == patient_id)
            .order_by(MealTrackingDB.date.desc(), MealTrackingDB.id.desc())
            .first()
        )
        return row[0] if row else None

    def build_patient_adherence_alerts(patient, metrics, days_without_log: int, adherence_pct: int) -> List[dict]:
        alerts: List[dict] = []
        if days_without_log >= 3:
            alerts.append(
                {
                    "type": "no_meal_logs",
                    "severity": "high" if days_without_log >= 5 else "medium",
                    "message": f"Sin registrar comidas hace {days_without_log} días",
                }
            )
        if adherence_pct < 50 and adherence_pct >= 0:
            alerts.append(
                {
                    "type": "low_adherence",
                    "severity": "medium",
                    "message": f"Adherencia baja ({adherence_pct}%) en el periodo",
                }
            )
        if len(metrics) >= 2:
            w0, w1 = metrics[0].weight, metrics[1].weight
            if w0 is not None and w1 is not None:
                change = w0 - w1
                if abs(change) >= 2:
                    direction = "subió" if change > 0 else "bajó"
                    alerts.append(
                        {
                            "type": "rapid_weight_change",
                            "severity": "warning",
                            "message": f"Peso {direction} {abs(change):.1f} kg en ~7 días",
                        }
                    )
        return alerts

    def get_analytics_patient_scope(
        db: Session,
        current_user,
        cohort: Optional[str] = None,
        organization_id: Optional[int] = None,
        programa_eps: Optional[str] = None,
    ) -> List[dict]:
        query = db.query(UserDB).filter(UserDB.role == "patient", UserDB.status == "activo")
        if current_user.role == "admin":
            query = query.filter(UserDB.nutritionist_id == current_user.id)
        if programa_eps and hasattr(UserDB, "programa_eps"):
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
        scoped: List[dict] = []
        for patient in patients:
            active_assignment = (
                db.query(PatientMealPlanDB)
                .filter(
                    PatientMealPlanDB.patient_id == patient.id,
                    PatientMealPlanDB.status == "active",
                )
                .first()
            )
            if not active_assignment:
                continue
            plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_assignment.meal_plan_id).first()
            plan_tipo = getattr(plan, "tipo", None) or "adulto"
            if cohort and cohort != "all" and plan_tipo != cohort:
                continue
            scoped.append(
                {
                    "patient": patient,
                    "plan": plan,
                    "assignment": active_assignment,
                    "plan_tipo": plan_tipo,
                }
            )
        return scoped

    def cohort_weight_trends(scoped: List[dict], db: Session, weeks: int = 8) -> dict:
        today = today_co()
        by_cohort: dict = {}
        for item in scoped:
            tipo = item["plan_tipo"]
            by_cohort.setdefault(tipo, []).append(item["patient"].id)

        result = {}
        for tipo, patient_ids in by_cohort.items():
            series = []
            for w in range(weeks - 1, -1, -1):
                week_end = today - timedelta(days=w * 7)
                week_start = week_end - timedelta(days=6)
                weights = []
                for pid in patient_ids:
                    metric = (
                        db.query(ProgressMetricDB)
                        .filter(
                            ProgressMetricDB.patient_id == pid,
                            ProgressMetricDB.date >= week_start,
                            ProgressMetricDB.date <= week_end,
                        )
                        .order_by(ProgressMetricDB.date.desc())
                        .first()
                    )
                    if metric and metric.weight is not None:
                        weights.append(metric.weight)
                series.append(
                    {
                        "week_start": week_start.strftime("%Y-%m-%d"),
                        "week_label": week_start.strftime("%d/%m"),
                        "avg_weight": round(sum(weights) / len(weights), 2) if weights else None,
                        "sample_size": len(weights),
                    }
                )
            result[tipo] = {
                "label": PLAN_TIPO_LABELS.get(tipo, tipo),
                "series": series,
                "patient_count": len(patient_ids),
            }
        return result

    def build_adherence_dashboard_payload(
        db: Session,
        current_user,
        days: int = 7,
        cohort: Optional[str] = None,
        organization_id: Optional[int] = None,
        programa_eps: Optional[str] = None,
    ) -> dict:
        days = max(1, min(days, 90))
        end_date = today_co()
        start_date = end_date - timedelta(days=days - 1)
        scoped = get_analytics_patient_scope(
            db, current_user, cohort=cohort,
            organization_id=organization_id, programa_eps=programa_eps,
        )

        patient_rows = []
        all_alerts = []
        adherence_values = []

        org_map = {}
        if OrganizationMemberDB is not None and OrganizationDB is not None:
            for om in db.query(OrganizationMemberDB).filter(OrganizationMemberDB.status == "activo").all():
                org = db.query(OrganizationDB).filter(OrganizationDB.id == om.organization_id).first()
                if org:
                    org_map[om.user_id] = org.name

        for item in scoped:
            patient = item["patient"]
            plan = item["plan"]
            adherence = calculate_adherence_for_period(patient.id, db, start_date, end_date)
            adherence_values.append(adherence["adherence_pct"])

            last_activity = get_last_meal_activity_date(patient.id, db)
            days_without = (end_date - last_activity).days if last_activity else 999

            metrics = (
                db.query(ProgressMetricDB)
                .filter(ProgressMetricDB.patient_id == patient.id)
                .order_by(ProgressMetricDB.date.desc())
                .limit(12)
                .all()
            )
            patient_alerts = build_patient_adherence_alerts(
                patient, metrics, days_without, adherence["adherence_pct"]
            )
            for alert in patient_alerts:
                all_alerts.append(
                    {
                        **alert,
                        "patient_id": patient.id,
                        "patient_name": f"{patient.nombres} {patient.apellidos}",
                    }
                )

            current_weight = patient.peso_actual or (metrics[0].weight if metrics else None)
            initial_weight = get_initial_weight(patient.id, db)
            weight_change = None
            if current_weight and initial_weight:
                weight_change = round(current_weight - initial_weight, 2)

            patient_rows.append(
                {
                    "id": patient.id,
                    "name": f"{patient.nombres} {patient.apellidos}",
                    "avatar": patient.foto_perfil,
                    "plan": plan.name if plan else "Sin plan",
                    "plan_tipo": item["plan_tipo"],
                    "plan_tipo_label": PLAN_TIPO_LABELS.get(item["plan_tipo"], item["plan_tipo"]),
                    "programa_eps": getattr(patient, "programa_eps", None),
                    "organization": org_map.get(patient.id),
                    "adherence_pct": adherence["adherence_pct"],
                    "completed_meals": adherence["completed_meals"],
                    "total_meals": adherence["total_meals"],
                    "days_without_logs": days_without if days_without < 999 else None,
                    "last_meal_log": last_activity.strftime("%Y-%m-%d") if last_activity else None,
                    "current_weight": current_weight,
                    "goal_weight": patient.peso_objetivo,
                    "weight_change": weight_change,
                    "alerts_count": len(patient_alerts),
                    "alerts": patient_alerts,
                }
            )

        patient_rows.sort(key=lambda r: (r["alerts_count"], -r["adherence_pct"]), reverse=True)
        all_alerts.sort(
            key=lambda a: {"high": 0, "warning": 1, "medium": 2}.get(a.get("severity", "medium"), 3)
        )

        avg_adherence = int(sum(adherence_values) / len(adherence_values)) if adherence_values else 0
        patients_at_risk = len([r for r in patient_rows if r["alerts_count"] > 0 or r["adherence_pct"] < 60])

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
            "period_days": days,
            "period_start": start_date.strftime("%Y-%m-%d"),
            "period_end": end_date.strftime("%Y-%m-%d"),
            "summary": {
                "total_patients": len(patient_rows),
                "avg_adherence": avg_adherence,
                "patients_on_track": len([r for r in patient_rows if r["adherence_pct"] >= 80]),
                "patients_at_risk": patients_at_risk,
                "total_alerts": len(all_alerts),
            },
            "patients": patient_rows,
            "cohort_trends": cohort_weight_trends(scoped, db),
            "alerts": all_alerts[:50],
            "filter_options": {
                "cohorts": [{"value": k, "label": v} for k, v in PLAN_TIPO_LABELS.items()],
                "organizations": org_options,
                "eps_programs": eps_options,
            },
        }

    def adherence_export_csv(payload: dict) -> str:
        import csv
        from io import StringIO

        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "Paciente", "Plan", "Cohorte", "EPS/Programa", "Organización",
                "Adherencia %", "Comidas completadas", "Comidas totales",
                "Días sin registro", "Último registro", "Peso actual",
                "Peso objetivo", "Cambio peso", "Alertas",
            ]
        )
        for row in payload["patients"]:
            alert_msgs = "; ".join(a["message"] for a in row.get("alerts", []))
            writer.writerow(
                [
                    row["name"], row["plan"], row["plan_tipo_label"],
                    row.get("programa_eps") or "", row.get("organization") or "",
                    row["adherence_pct"], row["completed_meals"], row["total_meals"],
                    row.get("days_without_logs") or "", row.get("last_meal_log") or "",
                    row.get("current_weight") or "", row.get("goal_weight") or "",
                    row.get("weight_change") or "", alert_msgs,
                ]
            )
        return output.getvalue()

    def adherence_export_pdf(payload: dict, current_user, db: Session) -> bytes:
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
        c.drawString(50, y, "NutriData — Reporte de Adherencia")
        y -= 24
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10)
        s = payload["summary"]
        c.drawString(50, y, f"Periodo: {payload['period_start']} → {payload['period_end']} ({payload['period_days']} días)")
        y -= 16
        c.drawString(50, y, f"Pacientes: {s['total_patients']} | Adherencia prom: {s['avg_adherence']}% | En riesgo: {s['patients_at_risk']}")
        y -= 28
        c.setFont("Helvetica-Bold", 9)
        c.drawString(50, y, "Paciente")
        c.drawString(220, y, "Plan")
        c.drawString(360, y, "Adherencia")
        y -= 14
        c.setFont("Helvetica", 8)
        for row in payload["patients"][:40]:
            if y < 120:
                c.showPage()
                y = height - 50
            c.drawString(50, y, str(row["name"])[:28])
            c.drawString(220, y, str(row["plan"])[:22])
            c.drawString(360, y, f"{row['adherence_pct']}%")
            y -= 12

        generated_at_dt = now_co()
        generated_at = generated_at_dt.strftime("%Y-%m-%d %H:%M COT")
        nutri_name, license_to, specialty = get_nutritionist_signatory(db, current_user, AdminProfileDB)
        verification_code = make_verification_code(current_user.id, "adherence_report", generated_at_dt)
        sig_y = 95 if y > 120 else 95
        draw_pdf_signature_block(
            c,
            x=50,
            y=sig_y,
            width=width - 100,
            nutritionist_name=nutri_name,
            license_to=license_to,
            specialty=specialty,
            generated_at=generated_at,
            verification_code=verification_code,
            doc_label="Reporte de adherencia",
        )
        c.save()
        buffer.seek(0)
        return buffer.getvalue()

    @app.get("/api/analytics/adherence/dashboard")
    def get_adherence_dashboard(
        days: int = 7,
        cohort: Optional[str] = None,
        organization_id: Optional[int] = None,
        programa_eps: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        return build_adherence_dashboard_payload(
            db, current_user, days=days, cohort=cohort,
            organization_id=organization_id, programa_eps=programa_eps,
        )

    @app.get("/api/analytics/adherence/export")
    def export_adherence(
        format: str = "csv",
        days: int = 7,
        cohort: Optional[str] = None,
        organization_id: Optional[int] = None,
        programa_eps: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        payload = build_adherence_dashboard_payload(
            db, current_user, days=days, cohort=cohort,
            organization_id=organization_id, programa_eps=programa_eps,
        )
        if format == "pdf":
            pdf_bytes = adherence_export_pdf(payload, current_user, db)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=adherencia_{today_co()}.pdf"},
            )
        csv_text = adherence_export_csv(payload)
        return Response(
            content=csv_text,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=adherencia_{today_co()}.csv"},
        )
