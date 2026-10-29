"""Utilidades compartidas: días sin registro de comidas y fechas."""
from __future__ import annotations

from datetime import date
from typing import Any, Optional


def parse_co_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    text = str(value).strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def last_meal_log_date(patient_id: int, db, MealTrackingDB) -> Optional[date]:
    row = (
        db.query(MealTrackingDB.date)
        .filter(MealTrackingDB.patient_id == patient_id)
        .order_by(MealTrackingDB.date.desc(), MealTrackingDB.id.desc())
        .first()
    )
    if not row:
        return None
    return parse_co_date(row[0])


def days_without_meal_logs(
    patient_id: int,
    db,
    today: date,
    MealTrackingDB,
    PatientMealPlanDB=None,
) -> Optional[int]:
    """
    Días sin registrar comidas.
    - Con historial: días desde el último log.
    - Sin historial pero con plan activo: días desde inicio/asignación del plan.
    - Sin historial ni plan: None (no alertar con 999).
    """
    last = last_meal_log_date(patient_id, db, MealTrackingDB)
    if last is not None:
        return max(0, (today - last).days)

    if PatientMealPlanDB is not None:
        assignment = (
            db.query(PatientMealPlanDB)
            .filter(
                PatientMealPlanDB.patient_id == patient_id,
                PatientMealPlanDB.status == "active",
            )
            .first()
        )
        if assignment is not None:
            start = parse_co_date(assignment.start_date or assignment.assigned_date)
            if start is not None and start <= today:
                return max(0, (today - start).days)

    return None


def no_meal_logs_alert(days_without: Optional[int], *, min_days: int = 3) -> Optional[dict]:
    """Alerta de adherencia por gap de registros, o None si no aplica."""
    if days_without is None or days_without < min_days:
        return None
    return {
        "type": "no_meal_logs",
        "severity": "high" if days_without >= 5 else "medium",
        "message": f"Sin registrar comidas hace {days_without} días",
    }
