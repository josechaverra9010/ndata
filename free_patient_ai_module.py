"""Plan Gratis paciente: gasto calórico, meta al peso ideal y 2 sugerencias de comida con IA."""
from __future__ import annotations

import json
import os
import re
from datetime import date
from typing import Any, Callable, Dict, List, Optional

import requests
from fastapi import Depends, HTTPException
from sqlalchemy import Column, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Session

FreeMealSuggestionDB = None

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_FREE_MODEL = os.getenv(
    "OPENAI_FREE_MODEL",
    os.getenv("OPENAI_MENU_MODEL", os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini")),
).strip()

PAL_MAP = {
    "sedentario": 1.2,
    "sedentary": 1.2,
    "ligero": 1.375,
    "light": 1.375,
    "moderado": 1.55,
    "moderate": 1.55,
    "activo": 1.725,
    "active": 1.725,
    "muy_activo": 1.9,
    "muy activo": 1.9,
    "very_active": 1.9,
}

SYSTEM_PROMPT = """Eres un nutricionista colombiano. Das sugerencias de COMIDAS prácticas (no un plan completo ni menú semanal).
Responde ÚNICAMENTE JSON válido (sin markdown):
{
  "suggestions": [
    {
      "title": "nombre corto del plato",
      "meal_moment": "Desayuno|Almuerzo|Cena|Snack",
      "calories": 450,
      "protein_g": 25,
      "description": "1-2 frases motivadoras y claras",
      "ingredients": ["ingrediente 1 con cantidad aproximada", "ingrediente 2"],
      "why": "por qué encaja con su meta de calorías/peso"
    },
    { ... segunda sugerencia distinta ... }
  ]
}
Reglas:
- Exactamente 2 sugerencias, diferentes entre sí
- Alimentos típicos de Colombia, fáciles de conseguir
- calories estimadas por porción (enteros)
- ingredients: 3 a 8 ítems
- Respeta alergias y disgustos
- No digas "plan nutricional" ni listes un menú del día completo
- Tonó cercano y útil para alguien en plan gratuito"""


def register_free_patient_ai_model(Base):
    global FreeMealSuggestionDB

    class _FreeMealSuggestionDB(Base):
        __tablename__ = "free_meal_suggestions"
        __table_args__ = (UniqueConstraint("patient_id", "for_date", name="uq_free_meal_patient_date"),)
        id = Column(Integer, primary_key=True, index=True)
        patient_id = Column(Integer, nullable=False, index=True)
        for_date = Column(String(20), nullable=False, index=True)
        payload = Column(Text, nullable=False)
        created_at = Column(String(50), nullable=True)

    FreeMealSuggestionDB = _FreeMealSuggestionDB
    return FreeMealSuggestionDB


def ensure_free_patient_ai_schema(engine, inspect_fn, text_fn):
    try:
        insp = inspect_fn(engine)
        if "free_meal_suggestions" in insp.get_table_names():
            return
        dialect = engine.dialect.name
        if dialect == "sqlite":
            ddl = """
            CREATE TABLE IF NOT EXISTS free_meal_suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                for_date VARCHAR(20) NOT NULL,
                payload TEXT NOT NULL,
                created_at VARCHAR(50),
                UNIQUE(patient_id, for_date)
            )
            """
        else:
            ddl = """
            CREATE TABLE IF NOT EXISTS free_meal_suggestions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_id INT NOT NULL,
                for_date VARCHAR(20) NOT NULL,
                payload TEXT NOT NULL,
                created_at VARCHAR(50) NULL,
                UNIQUE KEY uq_free_meal_patient_date (patient_id, for_date),
                INDEX ix_free_meal_patient (patient_id)
            )
            """
        with engine.begin() as conn:
            conn.execute(text_fn(ddl))
        print("[FREE_AI] tabla free_meal_suggestions creada")
    except Exception as e:
        print(f"[FREE_AI] schema: {e}")


def _age_years(fecha_nacimiento) -> Optional[float]:
    if not fecha_nacimiento:
        return None
    try:
        if isinstance(fecha_nacimiento, str):
            birth = date.fromisoformat(fecha_nacimiento[:10])
        else:
            birth = fecha_nacimiento
        today = date.today()
        years = today.year - birth.year - (
            (today.month, today.day) < (birth.month, birth.day)
        )
        return float(max(1, years))
    except Exception:
        return None


def _sexo_code(genero: Optional[str]) -> Optional[str]:
    g = (genero or "").strip().lower()
    if g in ("m", "masculino", "male", "hombre", "h"):
        return "M"
    if g in ("f", "femenino", "female", "mujer"):
        return "F"
    return None


def _pal(nivel_actividad: Optional[str], pal_factor: Optional[float] = None) -> float:
    if pal_factor and float(pal_factor) > 0:
        return float(pal_factor)
    key = (nivel_actividad or "moderado").strip().lower().replace("-", "_")
    return PAL_MAP.get(key, 1.55)


def _bmr_mifflin(peso: float, altura_cm: float, edad: float, sexo: str) -> float:
    base = 10 * peso + 6.25 * altura_cm - 5 * edad
    return base + 5 if sexo == "M" else base - 161


def _ideal_weight_kg(altura_cm: float, peso_objetivo: Optional[float]) -> float:
    if peso_objetivo and float(peso_objetivo) > 0:
        return float(peso_objetivo)
    h_m = altura_cm / 100.0
    # IMC 22 como peso ideal de referencia
    return round(22.0 * h_m * h_m, 1)


def compute_calorie_guide(user) -> dict:
    """Quema habitual (TDEE) y kcal a consumir para avanzar al peso ideal."""
    peso = float(getattr(user, "peso_actual", None) or 0)
    altura = float(getattr(user, "altura", None) or 0)
    edad = _age_years(getattr(user, "fecha_nacimiento", None))
    sexo = _sexo_code(getattr(user, "genero", None))
    pal = _pal(getattr(user, "nivel_actividad", None), getattr(user, "pal_factor", None))
    peso_obj = getattr(user, "peso_objetivo", None)

    missing = []
    if not (peso > 0):
        missing.append("peso_actual")
    if not (altura > 0):
        missing.append("altura")
    if not edad:
        missing.append("fecha_nacimiento")
    if not sexo:
        missing.append("genero")

    if missing:
        return {
            "ready": False,
            "missing": missing,
            "message": "Completa tu perfil (peso, altura, fecha de nacimiento y género) para calcular tus calorías.",
        }

    ideal = _ideal_weight_kg(altura, float(peso_obj) if peso_obj else None)
    bmr = _bmr_mifflin(peso, altura, edad, sexo)
    tdee = round(bmr * pal)
    bmr_ideal = _bmr_mifflin(ideal, altura, edad, sexo)
    tdee_ideal = round(bmr_ideal * pal)

    delta = peso - ideal
    if delta > 1.0:
        # Déficit moderado hacia el peso ideal
        consume = max(1200 if sexo == "F" else 1500, tdee - 400)
        goal = "bajar"
        note = "Déficit moderado (~400 kcal) para acercarte a tu peso ideal de forma sostenible."
    elif delta < -1.0:
        consume = tdee + 300
        goal = "subir"
        note = "Superávit moderado (~300 kcal) para ganar peso hacia tu meta."
    else:
        consume = tdee_ideal
        goal = "mantener"
        note = "Ya estás cerca de tu peso ideal: mantén tu gasto habitual."

    consume = int(round(consume))
    return {
        "ready": True,
        "missing": [],
        "message": None,
        "peso_actual_kg": round(peso, 1),
        "peso_ideal_kg": round(ideal, 1),
        "altura_cm": round(altura, 1),
        "edad_years": int(edad),
        "sexo": sexo,
        "nivel_actividad": getattr(user, "nivel_actividad", None) or "moderado",
        "pal": pal,
        "bmr_kcal": int(round(bmr)),
        "calories_burned_daily": int(tdee),
        "calories_to_consume": consume,
        "calories_at_ideal_maintenance": int(tdee_ideal),
        "goal": goal,
        "note": note,
        "formula": "Mifflin-St Jeor × factor de actividad",
    }


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        raise ValueError("Respuesta vacía del modelo")
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start : end + 1])
        raise ValueError("No se pudo interpretar la respuesta de IA")


def _int(v: Any, default: int = 0) -> int:
    try:
        return max(0, int(round(float(v))))
    except (TypeError, ValueError):
        return default


def _normalize_suggestions(raw: dict, target_kcal: int) -> List[dict]:
    items = raw.get("suggestions") if isinstance(raw, dict) else None
    if not isinstance(items, list):
        items = []
    out: List[dict] = []
    for item in items[:2]:
        if not isinstance(item, dict):
            continue
        ingredients = item.get("ingredients") or []
        if isinstance(ingredients, str):
            ingredients = [ingredients]
        ingredients = [str(x).strip() for x in ingredients if str(x).strip()][:10]
        out.append(
            {
                "title": str(item.get("title") or item.get("name") or "Sugerencia").strip()[:120],
                "meal_moment": str(item.get("meal_moment") or item.get("moment") or "Almuerzo").strip()[:40],
                "calories": _int(item.get("calories"), max(250, target_kcal // 3)),
                "protein_g": _int(item.get("protein_g") or item.get("protein"), 0),
                "description": str(item.get("description") or "").strip()[:400],
                "ingredients": ingredients,
                "why": str(item.get("why") or "").strip()[:300],
                "ai_generated": True,
            }
        )
    return out


def _fallback_suggestions(guide: dict) -> List[dict]:
    target = int(guide.get("calories_to_consume") or 1800)
    portion = max(280, min(650, target // 3))
    return [
        {
            "title": "Bowl de pollo, arroz y ensalada",
            "meal_moment": "Almuerzo",
            "calories": portion,
            "protein_g": 35,
            "description": "Plato equilibrado con proteína magra, carbohidrato y vegetales frescos.",
            "ingredients": [
                "Pechuga de pollo 120 g",
                "Arroz cocido 100 g",
                "Tomate, lechuga y pepino al gusto",
                "1 cucharadita de aceite de oliva",
            ],
            "why": f"Aporta cerca de {portion} kcal y te acerca a tu meta diaria de {target} kcal.",
            "ai_generated": False,
        },
        {
            "title": "Avena con fruta y yogurt",
            "meal_moment": "Desayuno",
            "calories": max(250, portion - 80),
            "protein_g": 18,
            "description": "Desayuno práctico, saciante y fácil de preparar en casa.",
            "ingredients": [
                "Avena 40 g",
                "Yogurt natural 150 g",
                "Banano o fresas 1 porción",
                "Canela al gusto",
            ],
            "why": "Buena opción para empezar el día sin pasarte de tu meta calórica.",
            "ai_generated": False,
        },
    ]


def _call_openai(user_prompt: str) -> dict:
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY no configurada")
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": OPENAI_FREE_MODEL,
            "temperature": 0.7,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=90,
    )
    if resp.status_code >= 400:
        raise ValueError(f"OpenAI error {resp.status_code}: {resp.text[:300]}")
    content = resp.json()["choices"][0]["message"]["content"]
    return _extract_json(content)


def generate_two_meal_suggestions(user, guide: dict) -> List[dict]:
    target = int(guide.get("calories_to_consume") or 1800)
    if not OPENAI_API_KEY:
        return _fallback_suggestions(guide)

    alergias = getattr(user, "alergias", None) or []
    if isinstance(alergias, str):
        try:
            alergias = json.loads(alergias)
        except Exception:
            alergias = [alergias]
    disgustos = getattr(user, "alimentos_disgusto", None) or ""
    objetivos = getattr(user, "objetivos_salud", None) or ""

    parts = [
        f"Paciente: {guide.get('sexo')} {guide.get('edad_years')} años, "
        f"{guide.get('peso_actual_kg')} kg, altura {guide.get('altura_cm')} cm.",
        f"Peso ideal / meta: {guide.get('peso_ideal_kg')} kg (objetivo: {guide.get('goal')}).",
        f"Quema habitual estimada: {guide.get('calories_burned_daily')} kcal/día.",
        f"Debe consumir alrededor de {target} kcal/día para avanzar a su peso ideal.",
        f"Actividad: {guide.get('nivel_actividad')} (PAL {guide.get('pal')}).",
        "Genera exactamente 2 sugerencias de comidas (no un plan completo).",
        "Cada sugerencia debe aportar una porción razonable del día (aprox. 25-40% de la meta).",
    ]
    if objetivos:
        parts.append(f"Objetivos de salud: {objetivos}")
    if alergias:
        parts.append(f"Alergias / restricciones: {', '.join(str(a) for a in alergias)}")
    if disgustos:
        parts.append(f"No le gustan / no consume: {disgustos}")

    try:
        raw = _call_openai("\n".join(parts))
        suggestions = _normalize_suggestions(raw, target)
        if len(suggestions) < 2:
            return _fallback_suggestions(guide)
        return suggestions
    except Exception as e:
        print(f"[FREE_AI] generate fallback: {e}")
        return _fallback_suggestions(guide)


def _require_free_ai_access(db: Session, user) -> None:
    if getattr(user, "role", None) != "patient":
        raise HTTPException(status_code=403, detail="Solo pacientes")
    try:
        from billing_module import get_patient_plan_features
    except Exception:
        return
    feats = get_patient_plan_features(db, user.id)
    # Acceso en plan gratis (o si el feature está activo). Trial/Esencial con meals no lo necesita.
    if feats.get("ai_meal_suggestions") or (
        feats.get("_plan_code") == "patient_free" and not feats.get("meals")
    ):
        return
    # Permitir también si no tiene meals/my_plan (modo gratis efectivo)
    if not feats.get("meals") and not feats.get("my_plan"):
        return
    raise HTTPException(
        status_code=403,
        detail={
            "code": "not_free_tier",
            "message": "Esta vista es del plan Gratis. Tu plan incluye comidas y plan nutricional.",
        },
    )


def register_free_patient_ai_routes(app, deps: dict):
    get_db = deps["get_db"]
    get_current_user = deps["get_current_user"]
    UserDB = deps["UserDB"]
    today_co: Callable = deps["today_co"]
    now_co: Callable = deps["now_co"]

    @app.get("/api/patient/free/calorie-guide")
    def free_calorie_guide(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_free_ai_access(db, current_user)
        user = db.query(UserDB).filter(UserDB.id == current_user.id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        guide = compute_calorie_guide(user)
        return {"success": True, "guide": guide, "ai_enabled": bool(OPENAI_API_KEY)}

    @app.get("/api/patient/free/meal-suggestions")
    def free_meal_suggestions(
        refresh: bool = False,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        _require_free_ai_access(db, current_user)
        user = db.query(UserDB).filter(UserDB.id == current_user.id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        guide = compute_calorie_guide(user)
        if not guide.get("ready"):
            return {
                "success": True,
                "guide": guide,
                "suggestions": [],
                "cached": False,
                "ai_enabled": bool(OPENAI_API_KEY),
            }

        today = today_co().strftime("%Y-%m-%d") if callable(today_co) else date.today().isoformat()
        cached_row = None
        if FreeMealSuggestionDB is not None and not refresh:
            cached_row = (
                db.query(FreeMealSuggestionDB)
                .filter(
                    FreeMealSuggestionDB.patient_id == user.id,
                    FreeMealSuggestionDB.for_date == today,
                )
                .first()
            )
            if cached_row:
                try:
                    payload = json.loads(cached_row.payload)
                    return {
                        "success": True,
                        "guide": guide,
                        "suggestions": payload.get("suggestions") or [],
                        "cached": True,
                        "for_date": today,
                        "ai_enabled": bool(OPENAI_API_KEY),
                    }
                except Exception:
                    pass

        suggestions = generate_two_meal_suggestions(user, guide)
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S") if callable(now_co) else ""
        if FreeMealSuggestionDB is not None:
            row = (
                db.query(FreeMealSuggestionDB)
                .filter(
                    FreeMealSuggestionDB.patient_id == user.id,
                    FreeMealSuggestionDB.for_date == today,
                )
                .first()
            )
            blob = json.dumps({"suggestions": suggestions}, ensure_ascii=False)
            if row:
                row.payload = blob
                row.created_at = ts
            else:
                db.add(
                    FreeMealSuggestionDB(
                        patient_id=user.id,
                        for_date=today,
                        payload=blob,
                        created_at=ts,
                    )
                )
            try:
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"[FREE_AI] cache save: {e}")

        return {
            "success": True,
            "guide": guide,
            "suggestions": suggestions,
            "cached": False,
            "for_date": today,
            "ai_enabled": bool(OPENAI_API_KEY),
        }
