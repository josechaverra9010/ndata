"""Snapshots inmutables de fases del plan (F1–F4) por asignación al paciente."""
from __future__ import annotations

import copy
import json
from datetime import date
from typing import Any, Callable, Dict, List, Optional


def register_phase_snapshot_model(Base, Column, Integer, String, ForeignKey, JSON):
    class PatientPhaseSnapshotDB(Base):
        __tablename__ = "patient_phase_snapshots"
        id = Column(Integer, primary_key=True, index=True)
        patient_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
        assignment_id = Column(
            Integer, ForeignKey("patient_meal_plans.id", ondelete="SET NULL"), index=True, nullable=True
        )
        meal_plan_id = Column(Integer, ForeignKey("meal_plans.id"), nullable=True, index=True)
        captured_at = Column(String(50), nullable=False)
        reason = Column(String(40), default="assign")  # assign | reactivate | manual
        plan_meta = Column(JSON, nullable=True)
        fase_1 = Column(JSON, nullable=True)
        fase_2 = Column(JSON, nullable=True)
        fase_3 = Column(JSON, nullable=True)
        fase_4 = Column(JSON, nullable=True)

    return PatientPhaseSnapshotDB


def ensure_phase_snapshot_schema(engine, inspect_fn, text_fn):
    try:
        inspector = inspect_fn(engine)
        tables = inspector.get_table_names()
        if "patient_phase_snapshots" in tables:
            return
        dialect = engine.dialect.name
        if dialect == "sqlite":
            ddl = """
            CREATE TABLE IF NOT EXISTS patient_phase_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                assignment_id INTEGER,
                meal_plan_id INTEGER,
                captured_at VARCHAR(50) NOT NULL,
                reason VARCHAR(40) DEFAULT 'assign',
                plan_meta JSON,
                fase_1 JSON,
                fase_2 JSON,
                fase_3 JSON,
                fase_4 JSON
            )
            """
        else:
            ddl = """
            CREATE TABLE IF NOT EXISTS patient_phase_snapshots (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_id INT NOT NULL,
                assignment_id INT NULL,
                meal_plan_id INT NULL,
                captured_at VARCHAR(50) NOT NULL,
                reason VARCHAR(40) DEFAULT 'assign',
                plan_meta JSON NULL,
                fase_1 JSON NULL,
                fase_2 JSON NULL,
                fase_3 JSON NULL,
                fase_4 JSON NULL,
                INDEX ix_pps_patient (patient_id),
                INDEX ix_pps_assignment (assignment_id)
            )
            """
        with engine.begin() as conn:
            conn.execute(text_fn(ddl))
        print("[PHASE_SNAPSHOT] tabla patient_phase_snapshots creada")
    except Exception as e:
        print(f"[PHASE_SNAPSHOT] schema migration skipped: {e}")


def _parse_phase(value: Any) -> Optional[dict]:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else None
        except (json.JSONDecodeError, TypeError):
            return None
    if isinstance(value, dict):
        return copy.deepcopy(value)
    return None


def _num(v: Any) -> Optional[float]:
    if v is None or v == "" or v == "---":
        return None
    try:
        n = float(v)
        if n != n:  # NaN
            return None
        return n
    except (TypeError, ValueError):
        return None


def build_plan_meta(plan) -> dict:
    if plan is None:
        return {}
    return {
        "plan_id": getattr(plan, "id", None),
        "name": getattr(plan, "name", None),
        "description": getattr(plan, "description", None) or "",
        "calories": getattr(plan, "calories", None) or 0,
        "protein_target": getattr(plan, "protein_target", None) or 0,
        "carbs_target": getattr(plan, "carbs_target", None) or 0,
        "fat_target": getattr(plan, "fat_target", None) or 0,
        "meals_per_day": getattr(plan, "meals_per_day", None) or 3,
        "tipo": getattr(plan, "tipo", None) or "adulto",
        "duration": getattr(plan, "duration", None),
        "category": getattr(plan, "category", None),
    }


def capture_patient_phase_snapshot(
    db,
    SnapshotModel,
    *,
    patient_id: int,
    assignment_id: Optional[int],
    plan,
    reason: str,
    now_co: Callable,
):
    """Persiste un snapshot inmutable de las fases del plan en el momento de la asignación."""
    if SnapshotModel is None or plan is None:
        return None
    row = SnapshotModel(
        patient_id=patient_id,
        assignment_id=assignment_id,
        meal_plan_id=getattr(plan, "id", None),
        captured_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
        reason=reason or "assign",
        plan_meta=build_plan_meta(plan),
        fase_1=_parse_phase(getattr(plan, "fase_1", None)),
        fase_2=_parse_phase(getattr(plan, "fase_2", None)),
        fase_3=_parse_phase(getattr(plan, "fase_3", None)),
        fase_4=_parse_phase(getattr(plan, "fase_4", None)),
    )
    db.add(row)
    db.flush()
    return row


def snapshot_summary(row) -> dict:
    """Resumen compacto para timeline/historial."""
    meta = row.plan_meta if isinstance(row.plan_meta, dict) else {}
    f1 = row.fase_1 if isinstance(row.fase_1, dict) else {}
    f2 = row.fase_2 if isinstance(row.fase_2, dict) else {}
    f3 = row.fase_3 if isinstance(row.fase_3, dict) else {}
    f4 = row.fase_4 if isinstance(row.fase_4, dict) else {}

    peso = (
        _num(f1.get("peso_actual"))
        or _num(f1.get("deportista_peso"))
        or _num(f1.get("pediatria_peso"))
        or _num(f1.get("peso_referencia"))
    )
    re_kcal = _num(f1.get("requerimiento_energetico")) or _num(f1.get("requerimiento_energetico_total"))
    kcal_f2 = _num(f2.get("total_calorias")) or _num(f2.get("total_calorias_f2")) or _num(meta.get("calories"))
    prot_f2 = _num(f2.get("proteinas_gramos")) or _num(f2.get("proteinas_gramos_f2"))
    chos_f2 = _num(f2.get("cho_gramos")) or _num(f2.get("cho_gramos_f2"))
    grasa_f2 = _num(f2.get("grasas_gramos")) or _num(f2.get("grasas_gramos_f2"))

    grupos = f3.get("grupos_alimentos") or f3.get("grupos_alimentos_f3") or f3.get("porciones_f3") or {}
    if isinstance(grupos, str):
        grupos = _parse_phase(grupos) or {}
    grupos_con_porcion = 0
    if isinstance(grupos, dict):
        for data in grupos.values():
            if isinstance(data, dict):
                p = _num(data.get("porciones") or data.get("porcion"))
                if p and p > 0:
                    grupos_con_porcion += 1
            elif _num(data) and _num(data) > 0:
                grupos_con_porcion += 1

    has_f4 = bool(
        (isinstance(f4.get("observaciones"), str) and f4.get("observaciones").strip())
        or f4.get("ingredientes_f4")
        or f4.get("comidas")
        or f4.get("meals")
    )

    return {
        "snapshot_id": row.id,
        "assignment_id": row.assignment_id,
        "meal_plan_id": row.meal_plan_id,
        "captured_at": row.captured_at,
        "reason": row.reason,
        "plan_name": meta.get("name"),
        "tipo": meta.get("tipo"),
        "calories": meta.get("calories"),
        "peso_kg": peso,
        "requerimiento_kcal": re_kcal,
        "macros_f2": {
            "kcal": kcal_f2,
            "prot": prot_f2,
            "chos": chos_f2,
            "grasa": grasa_f2,
        },
        "grupos_con_porcion_f3": grupos_con_porcion,
        "has_fase4_detail": has_f4,
        "imc": _num(f1.get("imc")),
        "clasificacion_imc": f1.get("clasificacion_imc"),
        "formula": f1.get("formula_requerimiento") or f1.get("metodo_energia"),
    }


def _change(
    field: str,
    label: str,
    before: Any,
    after: Any,
    unit: str = "",
    phase: str = "",
) -> Optional[dict]:
    if before == after:
        return None
    # Treat None and missing similarly for empty strings
    if before in (None, "", "---") and after in (None, "", "---"):
        return None
    nb, na = _num(before), _num(after)
    delta = None
    direction = "changed"
    if nb is not None and na is not None:
        delta = round(na - nb, 2)
        direction = "up" if delta > 0 else "down" if delta < 0 else "same"
        if direction == "same" and before == after:
            return None
    return {
        "field": field,
        "label": label,
        "unit": unit,
        "phase": phase,
        "before": before if before not in ("",) else None,
        "after": after if after not in ("",) else None,
        "delta": delta,
        "direction": direction if delta is not None else "changed",
    }


def _grupos_porciones(f3: Optional[dict]) -> Dict[str, float]:
    if not f3:
        return {}
    grupos = f3.get("grupos_alimentos") or f3.get("grupos_alimentos_f3") or f3.get("porciones_f3") or {}
    if isinstance(grupos, str):
        grupos = _parse_phase(grupos) or {}
    out: Dict[str, float] = {}
    if not isinstance(grupos, dict):
        return out
    for name, data in grupos.items():
        if isinstance(data, dict):
            p = _num(data.get("porciones") or data.get("porcion"))
        else:
            p = _num(data)
        if p and p > 0:
            out[str(name)] = p
    return out


def compare_phase_snapshots(left_row, right_row) -> List[dict]:
    """Compara dos filas PatientPhaseSnapshotDB (left = más reciente / A, right = referencia / B)."""
    left_meta = left_row.plan_meta if isinstance(left_row.plan_meta, dict) else {}
    right_meta = right_row.plan_meta if isinstance(right_row.plan_meta, dict) else {}
    lf1 = left_row.fase_1 if isinstance(left_row.fase_1, dict) else {}
    rf1 = right_row.fase_1 if isinstance(right_row.fase_1, dict) else {}
    lf2 = left_row.fase_2 if isinstance(left_row.fase_2, dict) else {}
    rf2 = right_row.fase_2 if isinstance(right_row.fase_2, dict) else {}
    lf3 = left_row.fase_3 if isinstance(left_row.fase_3, dict) else {}
    rf3 = right_row.fase_3 if isinstance(right_row.fase_3, dict) else {}
    lf4 = left_row.fase_4 if isinstance(left_row.fase_4, dict) else {}
    rf4 = right_row.fase_4 if isinstance(right_row.fase_4, dict) else {}

    changes: List[dict] = []

    def add(c):
        if c:
            changes.append(c)

    # Plan meta
    for key, label, unit in [
        ("calories", "Calorías objetivo", "kcal"),
        ("protein_target", "Proteína objetivo", "g"),
        ("carbs_target", "Carbohidratos objetivo", "g"),
        ("fat_target", "Grasas objetivo", "g"),
        ("meals_per_day", "Comidas/día", ""),
    ]:
        add(_change(key, label, right_meta.get(key), left_meta.get(key), unit, "meta"))
    add(_change("tipo", "Tipo de plan", right_meta.get("tipo"), left_meta.get("tipo"), "", "meta"))
    add(_change("name", "Nombre del plan", right_meta.get("name"), left_meta.get("name"), "", "meta"))

    # F1
    peso_l = (
        _num(lf1.get("peso_actual"))
        or _num(lf1.get("deportista_peso"))
        or _num(lf1.get("pediatria_peso"))
    )
    peso_r = (
        _num(rf1.get("peso_actual"))
        or _num(rf1.get("deportista_peso"))
        or _num(rf1.get("pediatria_peso"))
    )
    add(_change("peso", "Peso", peso_r, peso_l, "kg", "fase_1"))
    add(_change("imc", "IMC", _num(rf1.get("imc")), _num(lf1.get("imc")), "", "fase_1"))
    add(
        _change(
            "clasificacion_imc",
            "Clasificación IMC",
            rf1.get("clasificacion_imc"),
            lf1.get("clasificacion_imc"),
            "",
            "fase_1",
        )
    )
    add(
        _change(
            "requerimiento_energetico",
            "Requerimiento energético",
            _num(rf1.get("requerimiento_energetico")) or _num(rf1.get("requerimiento_energetico_total")),
            _num(lf1.get("requerimiento_energetico")) or _num(lf1.get("requerimiento_energetico_total")),
            "kcal",
            "fase_1",
        )
    )
    add(
        _change(
            "formula",
            "Fórmula / método",
            rf1.get("formula_requerimiento") or rf1.get("metodo_energia"),
            lf1.get("formula_requerimiento") or lf1.get("metodo_energia"),
            "",
            "fase_1",
        )
    )

    # F2
    add(
        _change(
            "f2_kcal",
            "F2 · Calorías",
            _num(rf2.get("total_calorias")) or _num(rf2.get("total_calorias_f2")),
            _num(lf2.get("total_calorias")) or _num(lf2.get("total_calorias_f2")),
            "kcal",
            "fase_2",
        )
    )
    add(
        _change(
            "f2_prot",
            "F2 · Proteína",
            _num(rf2.get("proteinas_gramos")) or _num(rf2.get("proteinas_gramos_f2")),
            _num(lf2.get("proteinas_gramos")) or _num(lf2.get("proteinas_gramos_f2")),
            "g",
            "fase_2",
        )
    )
    add(
        _change(
            "f2_chos",
            "F2 · Carbohidratos",
            _num(rf2.get("cho_gramos")) or _num(rf2.get("cho_gramos_f2")),
            _num(lf2.get("cho_gramos")) or _num(lf2.get("cho_gramos_f2")),
            "g",
            "fase_2",
        )
    )
    add(
        _change(
            "f2_grasa",
            "F2 · Grasas",
            _num(rf2.get("grasas_gramos")) or _num(rf2.get("grasas_gramos_f2")),
            _num(lf2.get("grasas_gramos")) or _num(lf2.get("grasas_gramos_f2")),
            "g",
            "fase_2",
        )
    )

    # F3 porciones
    lg = _grupos_porciones(lf3)
    rg = _grupos_porciones(rf3)
    all_groups = sorted(set(lg) | set(rg))
    for g in all_groups:
        add(_change(f"f3:{g}", f"F3 · {g}", rg.get(g), lg.get(g), "porc", "fase_3"))

    # F4
    obs_l = (lf4.get("observaciones") or "").strip() if isinstance(lf4.get("observaciones"), str) else ""
    obs_r = (rf4.get("observaciones") or "").strip() if isinstance(rf4.get("observaciones"), str) else ""
    add(_change("f4_obs", "F4 · Observaciones", obs_r or None, obs_l or None, "", "fase_4"))
    has_l = bool(lf4.get("ingredientes_f4") or lf4.get("comidas") or lf4.get("meals"))
    has_r = bool(rf4.get("ingredientes_f4") or rf4.get("comidas") or rf4.get("meals"))
    if has_l != has_r:
        add(
            _change(
                "f4_menu",
                "F4 · Detalle de menú/ingredientes",
                "Sí" if has_r else "No",
                "Sí" if has_l else "No",
                "",
                "fase_4",
            )
        )

    return changes


def serialize_snapshot_full(row) -> dict:
    return {
        "snapshot_id": row.id,
        "patient_id": row.patient_id,
        "assignment_id": row.assignment_id,
        "meal_plan_id": row.meal_plan_id,
        "captured_at": row.captured_at,
        "reason": row.reason,
        "plan_meta": row.plan_meta if isinstance(row.plan_meta, dict) else {},
        "fase_1": row.fase_1 if isinstance(row.fase_1, dict) else {},
        "fase_2": row.fase_2 if isinstance(row.fase_2, dict) else {},
        "fase_3": row.fase_3 if isinstance(row.fase_3, dict) else {},
        "fase_4": row.fase_4 if isinstance(row.fase_4, dict) else {},
        "summary": snapshot_summary(row),
    }


def parse_captured_date(captured_at: Optional[str]) -> Optional[date]:
    if not captured_at:
        return None
    try:
        return date.fromisoformat(str(captured_at)[:10])
    except ValueError:
        return None


PROGRESS_COMPARE_FIELDS = [
    ("weight", "Peso", "kg"),
    ("body_fat", "% Grasa", "%"),
    ("muscle", "Masa muscular", "%"),
    ("water", "Agua corporal", "%"),
    ("waist", "Cintura", "cm"),
    ("hip", "Cadera", "cm"),
    ("chest", "Pecho / tórax", "cm"),
    ("arm", "Brazo", "cm"),
]


def serialize_progress_metric(m) -> dict:
    d = m.date.isoformat() if hasattr(m.date, "isoformat") else str(m.date)
    return {
        "id": m.id,
        "patient_id": m.patient_id,
        "date": d,
        "weight": m.weight,
        "body_fat": m.body_fat,
        "muscle": m.muscle,
        "water": m.water,
        "waist": m.waist,
        "hip": m.hip,
        "chest": m.chest,
        "arm": m.arm,
        "notes": m.notes,
        "created_at": getattr(m, "created_at", None),
    }


def compare_progress_metrics(left, right) -> List[dict]:
    """Compara dos ProgressMetricDB. left = más reciente / A, right = referencia / B."""
    changes: List[dict] = []
    for key, label, unit in PROGRESS_COMPARE_FIELDS:
        lv = getattr(left, key, None)
        rv = getattr(right, key, None)
        c = _change(key, label, rv, lv, unit, "progress")
        if c:
            changes.append(c)
    # Notas (texto)
    ln = (left.notes or "").strip() if getattr(left, "notes", None) else ""
    rn = (right.notes or "").strip() if getattr(right, "notes", None) else ""
    if ln != rn and (ln or rn):
        changes.append(
            {
                "field": "notes",
                "label": "Notas",
                "unit": "",
                "phase": "progress",
                "before": rn or None,
                "after": ln or None,
                "delta": None,
                "direction": "changed",
            }
        )
    return changes
