"""Horarios de atención del nutricionista — disponibilidad para citas."""
from __future__ import annotations

import copy
import json
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple, TYPE_CHECKING

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Column, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase

NutritionistScheduleDB = None
NutritionistBlockedSlotDB = None

WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

WEEKDAY_LABELS = {
    "mon": "Lunes",
    "tue": "Martes",
    "wed": "Miércoles",
    "thu": "Jueves",
    "fri": "Viernes",
    "sat": "Sábado",
    "sun": "Domingo",
}

DEFAULT_WEEKLY_HOURS: Dict[str, List[Dict[str, str]]] = {
    "mon": [{"start": "08:00", "end": "19:00"}],
    "tue": [{"start": "08:00", "end": "19:00"}],
    "wed": [{"start": "08:00", "end": "19:00"}],
    "thu": [{"start": "08:00", "end": "19:00"}],
    "fri": [{"start": "08:00", "end": "19:00"}],
    "sat": [],
    "sun": [],
}

STANDARD_APPOINTMENT_SLOTS = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00", "18:30", "19:00",
]


class DayWindowSchema(BaseModel):
    start: str = Field(description="HH:MM")
    end: str = Field(description="HH:MM")


class WeeklyHoursSchema(BaseModel):
    mon: List[DayWindowSchema] = []
    tue: List[DayWindowSchema] = []
    wed: List[DayWindowSchema] = []
    thu: List[DayWindowSchema] = []
    fri: List[DayWindowSchema] = []
    sat: List[DayWindowSchema] = []
    sun: List[DayWindowSchema] = []


class NutritionistScheduleUpdateSchema(BaseModel):
    timezone: str = "America/Bogota"
    slot_interval_minutes: int = Field(default=30, ge=15, le=120)
    default_duration_minutes: int = Field(default=30, ge=15, le=180)
    weekly_hours: WeeklyHoursSchema


class BlockedSlotCreateSchema(BaseModel):
    date: str
    start_time: str
    end_time: str
    reason: Optional[str] = None


def register_schedule_models(Base):
    global NutritionistScheduleDB, NutritionistBlockedSlotDB

    class _NutritionistScheduleDB(Base):
        __tablename__ = "nutritionist_schedules"
        id = Column(Integer, primary_key=True, index=True)
        nutritionist_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
        timezone = Column(String(60), default="America/Bogota")
        slot_interval_minutes = Column(Integer, default=30)
        default_duration_minutes = Column(Integer, default=30)
        weekly_hours = Column(JSON, nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _NutritionistBlockedSlotDB(Base):
        __tablename__ = "nutritionist_blocked_slots"
        id = Column(Integer, primary_key=True, index=True)
        nutritionist_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        date = Column(String(10), nullable=False, index=True)
        start_time = Column(String(5), nullable=False)
        end_time = Column(String(5), nullable=False)
        reason = Column(Text, nullable=True)
        created_at = Column(String(50), nullable=True)

    NutritionistScheduleDB = _NutritionistScheduleDB
    NutritionistBlockedSlotDB = _NutritionistBlockedSlotDB
    return NutritionistScheduleDB, NutritionistBlockedSlotDB


def ensure_schedule_schema(engine, inspect_fn, text_fn):
    try:
        inspector = inspect_fn(engine)
        tables = inspector.get_table_names()
        for model in (NutritionistScheduleDB, NutritionistBlockedSlotDB):
            if model is not None and model.__tablename__ not in tables:
                model.__table__.create(bind=engine, checkfirst=True)
    except Exception as exc:
        print(f"[MIGRATE] schedule: {exc}")


def time_to_minutes(time_str: str) -> int:
    parts = str(time_str).strip().split(":")
    hours = int(parts[0])
    minutes = int(parts[1]) if len(parts) > 1 else 0
    return hours * 60 + minutes


def minutes_to_time(total: int) -> str:
    total = max(0, min(total, 24 * 60 - 1))
    return f"{total // 60:02d}:{total % 60:02d}"


def weekday_key_from_date(target_date) -> str:
    return WEEKDAY_KEYS[target_date.weekday()]


def normalize_weekly_hours(raw: Any) -> Dict[str, List[Dict[str, str]]]:
    base = copy.deepcopy(DEFAULT_WEEKLY_HOURS)
    if not raw:
        return base
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return base
    if not isinstance(raw, dict):
        return base
    out = copy.deepcopy(base)
    for key in WEEKDAY_KEYS:
        windows = raw.get(key, [])
        if not isinstance(windows, list):
            windows = []
        cleaned = []
        for w in windows:
            if not isinstance(w, dict):
                continue
            start = str(w.get("start", "")).strip()[:5]
            end = str(w.get("end", "")).strip()[:5]
            if start and end and time_to_minutes(start) < time_to_minutes(end):
                cleaned.append({"start": start, "end": end})
        out[key] = cleaned
    return out


def serialize_schedule(row) -> dict:
    weekly = normalize_weekly_hours(row.weekly_hours if row else None)
    return {
        "timezone": getattr(row, "timezone", None) or "America/Bogota",
        "slotIntervalMinutes": int(getattr(row, "slot_interval_minutes", None) or 30),
        "defaultDurationMinutes": int(getattr(row, "default_duration_minutes", None) or 30),
        "weeklyHours": weekly,
        "weekdayLabels": WEEKDAY_LABELS,
    }


def get_or_create_schedule(db: Session, nutritionist_id: int, now_co: Callable):
    if NutritionistScheduleDB is None:
        return None
    row = (
        db.query(NutritionistScheduleDB)
        .filter(NutritionistScheduleDB.nutritionist_id == nutritionist_id)
        .first()
    )
    if row:
        return row
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    row = NutritionistScheduleDB(
        nutritionist_id=nutritionist_id,
        timezone="America/Bogota",
        slot_interval_minutes=30,
        default_duration_minutes=30,
        weekly_hours=copy.deepcopy(DEFAULT_WEEKLY_HOURS),
        updated_at=ts,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def generate_slots_for_day(
    weekly_hours: Dict[str, List[Dict[str, str]]],
    weekday_key: str,
    interval_minutes: int,
) -> List[str]:
    windows = weekly_hours.get(weekday_key) or []
    if not windows:
        return []
    interval = max(15, min(int(interval_minutes or 30), 120))
    slots: List[str] = []
    seen = set()
    for window in windows:
        start = time_to_minutes(window.get("start", "08:00"))
        end = time_to_minutes(window.get("end", "19:00"))
        cursor = start
        while cursor + interval <= end:
            label = minutes_to_time(cursor)
            if label not in seen:
                seen.add(label)
                slots.append(label)
            cursor += interval
    return sorted(slots, key=time_to_minutes)


def get_blocked_ranges(db: Session, nutritionist_id: int, target_date) -> List[Tuple[int, int]]:
    if NutritionistBlockedSlotDB is None:
        return []
    date_str = target_date.strftime("%Y-%m-%d")
    rows = (
        db.query(NutritionistBlockedSlotDB)
        .filter(
            NutritionistBlockedSlotDB.nutritionist_id == nutritionist_id,
            NutritionistBlockedSlotDB.date == date_str,
        )
        .all()
    )
    ranges = []
    for row in rows:
        ranges.append((time_to_minutes(row.start_time), time_to_minutes(row.end_time)))
    return ranges


def is_slot_blocked(slot: str, blocked_ranges: List[Tuple[int, int]], duration_minutes: int) -> bool:
    start = time_to_minutes(slot)
    end = start + duration_minutes
    for b_start, b_end in blocked_ranges:
        if start < b_end and b_start < end:
            return True
    return False


def compute_available_slots_for_nutritionist(
    db: Session,
    target_date,
    *,
    nutritionist_id: Optional[int],
    duration: Optional[str] = "30 min",
    now_co: Callable,
    parse_duration_minutes: Callable,
    appointment_time_range: Callable,
    ranges_overlap: Callable,
    get_nutritionist_patient_ids: Callable,
    AppointmentDB,
) -> Tuple[List[str], List[str], List[str]]:
    """Retorna (slots_del_dia, disponibles, ocupados)."""
    duration_minutes = parse_duration_minutes(duration)

    if nutritionist_id is not None and NutritionistScheduleDB is not None:
        schedule_row = (
            db.query(NutritionistScheduleDB)
            .filter(NutritionistScheduleDB.nutritionist_id == nutritionist_id)
            .first()
        )
        weekly = normalize_weekly_hours(schedule_row.weekly_hours if schedule_row else None)
        interval = int(getattr(schedule_row, "slot_interval_minutes", None) or 30)
        day_slots = generate_slots_for_day(weekly, weekday_key_from_date(target_date), interval)
        blocked = get_blocked_ranges(db, nutritionist_id, target_date)
    else:
        day_slots = list(STANDARD_APPOINTMENT_SLOTS)
        blocked = []

    occupied_query = db.query(AppointmentDB).filter(
        AppointmentDB.date == target_date,
        AppointmentDB.status != "cancelada",
    )
    if nutritionist_id is not None:
        patient_ids = get_nutritionist_patient_ids(db, nutritionist_id)
        occupied = (
            occupied_query.filter(AppointmentDB.patient_id.in_(patient_ids)).all()
            if patient_ids
            else []
        )
    else:
        occupied = occupied_query.all()

    occupied_times = sorted({apt.time for apt in occupied})
    now = now_co()
    available: List[str] = []

    for slot in day_slots:
        if is_slot_blocked(slot, blocked, duration_minutes):
            continue
        if target_date == now.date():
            slot_time = datetime.strptime(slot, "%H:%M").time()
            if slot_time <= now.time():
                continue

        new_start, new_end = appointment_time_range(slot, duration)
        conflicts = False
        for apt in occupied:
            existing_start, existing_end = appointment_time_range(apt.time, apt.duration)
            if ranges_overlap(new_start, new_end, existing_start, existing_end):
                conflicts = True
                break
        if not conflicts:
            available.append(slot)

    return day_slots, available, occupied_times


def register_schedule_routes(app, deps: dict):
    get_db = deps["get_db"]
    get_current_user = deps["get_current_user"]
    require_admin_or_superadmin = deps["require_admin_or_superadmin"]
    UserDB = deps["UserDB"]
    now_co: Callable = deps["now_co"]

    def _authorize_schedule_user(user_id: int, current_user):
        if current_user.role == "superadmin":
            return
        if current_user.role == "admin" and current_user.id == user_id:
            return
        raise HTTPException(status_code=403, detail="No autorizado")

    @app.get("/api/admin/schedule/{user_id}")
    def get_nutritionist_schedule(
        user_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_admin_or_superadmin),
    ):
        _authorize_schedule_user(user_id, current_user)
        user = db.query(UserDB).filter(UserDB.id == user_id, UserDB.role.in_(["admin", "superadmin"])).first()
        if not user:
            raise HTTPException(status_code=404, detail="Nutricionista no encontrado")
        row = get_or_create_schedule(db, user_id, now_co)
        blocked = []
        if NutritionistBlockedSlotDB is not None:
            blocked = [
                {
                    "id": b.id,
                    "date": b.date,
                    "startTime": b.start_time,
                    "endTime": b.end_time,
                    "reason": b.reason,
                }
                for b in db.query(NutritionistBlockedSlotDB)
                .filter(NutritionistBlockedSlotDB.nutritionist_id == user_id)
                .order_by(NutritionistBlockedSlotDB.date.desc(), NutritionistBlockedSlotDB.id.desc())
                .limit(30)
                .all()
            ]
        return {**serialize_schedule(row), "blockedSlots": blocked}

    @app.put("/api/admin/schedule/{user_id}")
    def update_nutritionist_schedule(
        user_id: int,
        payload: NutritionistScheduleUpdateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_admin_or_superadmin),
    ):
        _authorize_schedule_user(user_id, current_user)
        if NutritionistScheduleDB is None:
            raise HTTPException(status_code=503, detail="Módulo de horarios no disponible")
        user = db.query(UserDB).filter(UserDB.id == user_id, UserDB.role.in_(["admin", "superadmin"])).first()
        if not user:
            raise HTTPException(status_code=404, detail="Nutricionista no encontrado")

        row = get_or_create_schedule(db, user_id, now_co)
        weekly_dict = payload.weekly_hours.model_dump()
        normalized = normalize_weekly_hours(weekly_dict)
        row.timezone = payload.timezone or "America/Bogota"
        row.slot_interval_minutes = payload.slot_interval_minutes
        row.default_duration_minutes = payload.default_duration_minutes
        row.weekly_hours = normalized
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        db.refresh(row)
        return {"success": True, "schedule": serialize_schedule(row)}

    @app.post("/api/admin/schedule/{user_id}/blocked-slots")
    def add_blocked_slot(
        user_id: int,
        payload: BlockedSlotCreateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_admin_or_superadmin),
    ):
        _authorize_schedule_user(user_id, current_user)
        if NutritionistBlockedSlotDB is None:
            raise HTTPException(status_code=503, detail="Módulo de horarios no disponible")
        if time_to_minutes(payload.start_time) >= time_to_minutes(payload.end_time):
            raise HTTPException(status_code=400, detail="Hora fin debe ser posterior a inicio")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = NutritionistBlockedSlotDB(
            nutritionist_id=user_id,
            date=payload.date,
            start_time=payload.start_time[:5],
            end_time=payload.end_time[:5],
            reason=payload.reason,
            created_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "success": True,
            "blockedSlot": {
                "id": row.id,
                "date": row.date,
                "startTime": row.start_time,
                "endTime": row.end_time,
                "reason": row.reason,
            },
        }

    @app.delete("/api/admin/schedule/{user_id}/blocked-slots/{slot_id}")
    def delete_blocked_slot(
        user_id: int,
        slot_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_admin_or_superadmin),
    ):
        _authorize_schedule_user(user_id, current_user)
        if NutritionistBlockedSlotDB is None:
            raise HTTPException(status_code=503, detail="Módulo de horarios no disponible")
        row = (
            db.query(NutritionistBlockedSlotDB)
            .filter(
                NutritionistBlockedSlotDB.id == slot_id,
                NutritionistBlockedSlotDB.nutritionist_id == user_id,
            )
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Bloqueo no encontrado")
        db.delete(row)
        db.commit()
        return {"success": True}
