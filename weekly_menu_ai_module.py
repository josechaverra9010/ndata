"""Generación de menús semanales con IA (OpenAI) usando catálogo de la plataforma."""
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

import requests

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MENU_MODEL = os.getenv("OPENAI_MENU_MODEL", os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini")).strip()

DAYS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

MEAL_SLOTS = [
    {"type": "desayuno", "time": "07:00"},
    {"type": "almuerzo", "time": "10:00"},  # Snack #1 (mealSchedule.ts)
    {"type": "comida", "time": "12:00"},
    {"type": "merienda", "time": "16:00"},
    {"type": "cena", "time": "19:00"},
]

# Reparto calórico clínico típico (suma = 1.0)
MEAL_KCAL_SHARE = {
    "desayuno": 0.25,
    "almuerzo": 0.10,  # snack AM
    "comida": 0.35,
    "merienda": 0.10,  # snack PM
    "cena": 0.20,
}

SYSTEM_PROMPT = """Eres un nutricionista clínico colombiano experto en planeación de menús semanales.
Generas un menú de 7 días (Lunes a Domingo) con 5 tiempos: desayuno, almuerzo (snack AM), comida, merienda (snack PM), cena.

OBLIGATORIO:
- Usa SOLO ingredientes y/o recetas del catálogo que te entregue el usuario (nombres exactos o muy cercanos).
- Cada comida debe listar ingredientes con gramos (enteros) tomados del catálogo.
- Si hay recetas del sistema, priorízalas (incluye recipe_id cuando corresponda) SOLO si sus kcal están cerca del presupuesto de esa comida (±20%).
- CRÍTICO: la suma de calories de las 5 comidas de CADA día debe ser EXACTAMENTE el objetivo diario indicado (o ±3% máximo).
- Respeta el presupuesto kcal por comida que te indiquen (desayuno/snack/comida/merienda/cena).
- Respeta alergias, disgustos y restricciones del paciente.
- Alimentos típicos de Colombia, porciones realistas, español claro.
- NO uses recetas de 100-200 kcal en el almuerzo principal ni platos de 700+ kcal en snacks.

Responde ÚNICAMENTE JSON válido (sin markdown):
{
  "name": "nombre corto del menú",
  "description": "descripción breve",
  "category": "Mantenimiento|Pérdida de peso|Ganancia muscular|Vegetariano|Vegano",
  "days": [
    {
      "day": "Lunes",
      "meals": [
        {
          "type": "desayuno|almuerzo|comida|merienda|cena",
          "recipe_id": null,
          "recipe_name": "nombre del plato",
          "calories": 0,
          "protein": 0,
          "carbs": 0,
          "fat": 0,
          "time": "HH:MM",
          "ingredients": [
            {"name": "nombre exacto del catálogo", "grams": 100}
          ],
          "notes": "opcional"
        }
      ]
    }
  ]
}
Reglas:
- Exactamente 7 días y 5 comidas por día
- calories/protein/carbs/fat: enteros (kcal y gramos) por comida
- ingredients: 2 a 8 ítems por comida; name del catálogo; grams > 0
- Varía proteínas y carbohidratos entre días
- No repitas el mismo plato principal más de 2 veces en la semana
- No inventes alimentos fuera del catálogo"""


def is_weekly_menu_ai_enabled() -> bool:
    return bool(OPENAI_API_KEY)


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
        raise ValueError("No se pudo interpretar la respuesta de IA como JSON")


def _int(v: Any) -> int:
    try:
        return max(0, int(round(float(v))))
    except (TypeError, ValueError):
        return 0


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _slot_kcal_targets(daily_kcal: int) -> Dict[str, int]:
    """Presupuesto kcal por comida; el último slot absorbe el redondeo."""
    daily = max(800, int(daily_kcal or 2000))
    targets: Dict[str, int] = {}
    assigned = 0
    slots = [s["type"] for s in MEAL_SLOTS]
    for i, slot_type in enumerate(slots):
        if i == len(slots) - 1:
            targets[slot_type] = max(80, daily - assigned)
        else:
            val = max(80, int(round(daily * MEAL_KCAL_SHARE.get(slot_type, 0.2))))
            targets[slot_type] = val
            assigned += val
    return targets


def _slot_macro_targets(daily_prot: int, daily_carbs: int, daily_fat: int) -> Dict[str, Dict[str, int]]:
    out: Dict[str, Dict[str, int]] = {}
    slots = [s["type"] for s in MEAL_SLOTS]
    for i, slot_type in enumerate(slots):
        share = MEAL_KCAL_SHARE.get(slot_type, 0.2)
        if i == len(slots) - 1:
            used_p = sum(out[s]["protein"] for s in out)
            used_c = sum(out[s]["carbs"] for s in out)
            used_f = sum(out[s]["fat"] for s in out)
            out[slot_type] = {
                "protein": max(2, int(daily_prot) - used_p),
                "carbs": max(3, int(daily_carbs) - used_c),
                "fat": max(2, int(daily_fat) - used_f),
            }
        else:
            out[slot_type] = {
                "protein": max(2, int(round(daily_prot * share))),
                "carbs": max(3, int(round(daily_carbs * share))),
                "fat": max(2, int(round(daily_fat * share))),
            }
    return out


def _scale_ingredients(ingredients: List[dict], factor: float) -> List[dict]:
    if not ingredients or factor <= 0:
        return ingredients or []
    # Evitar porciones absurdas
    factor = max(0.35, min(3.0, factor))
    out = []
    for ing in ingredients:
        copy = dict(ing)
        grams = copy.get("grams")
        try:
            g = float(grams) if grams is not None else None
        except (TypeError, ValueError):
            g = None
        if g is not None and g > 0:
            copy["grams"] = max(10, int(round(g * factor)))
        out.append(copy)
    return out


def _fit_day_to_targets(
    meals: List[dict],
    daily_kcal: int,
    daily_prot: int,
    daily_carbs: int,
    daily_fat: int,
) -> List[dict]:
    """Escala comidas del día para que sumen exactamente el objetivo diario."""
    if not meals:
        return meals
    target_kcal = max(800, int(daily_kcal or 2000))
    target_prot = max(40, int(daily_prot or 80))
    target_carbs = max(80, int(daily_carbs or 250))
    target_fat = max(30, int(daily_fat or 70))
    slot_kcal = _slot_kcal_targets(target_kcal)
    slot_macros = _slot_macro_targets(target_prot, target_carbs, target_fat)

    # Si faltan valores, rellena con presupuesto del slot
    for m in meals:
        st = str(m.get("type") or "")
        if _int(m.get("calories")) <= 0:
            m["calories"] = slot_kcal.get(st, target_kcal // 5)
        if _int(m.get("protein")) <= 0:
            m["protein"] = slot_macros.get(st, {}).get("protein", 10)
        if _int(m.get("carbs")) <= 0:
            m["carbs"] = slot_macros.get(st, {}).get("carbs", 20)
        if _int(m.get("fat")) <= 0:
            m["fat"] = slot_macros.get(st, {}).get("fat", 8)

    sum_kcal = sum(_int(m.get("calories")) for m in meals) or 1
    sum_prot = sum(_int(m.get("protein")) for m in meals) or 1
    sum_carbs = sum(_int(m.get("carbs")) for m in meals) or 1
    sum_fat = sum(_int(m.get("fat")) for m in meals) or 1

    factor_k = target_kcal / sum_kcal
    # Si está muy lejos (>12%), preferir redistribuir por shares clínicas
    redistribute = factor_k < 0.88 or factor_k > 1.12

    fitted: List[dict] = []
    running_k = running_p = running_c = running_f = 0
    for i, m in enumerate(meals):
        copy = dict(m)
        st = str(copy.get("type") or "")
        is_last = i == len(meals) - 1
        if redistribute:
            new_k = slot_kcal.get(st, target_kcal // 5)
            new_p = slot_macros.get(st, {}).get("protein", 10)
            new_c = slot_macros.get(st, {}).get("carbs", 20)
            new_f = slot_macros.get(st, {}).get("fat", 8)
            old_k = max(1, _int(m.get("calories")))
            copy["ingredients"] = _scale_ingredients(copy.get("ingredients") or [], new_k / old_k)
        else:
            if is_last:
                new_k = max(80, target_kcal - running_k)
                new_p = max(2, target_prot - running_p)
                new_c = max(3, target_carbs - running_c)
                new_f = max(2, target_fat - running_f)
            else:
                new_k = max(80, int(round(_int(m.get("calories")) * factor_k)))
                new_p = max(2, int(round(_int(m.get("protein")) * (target_prot / sum_prot))))
                new_c = max(3, int(round(_int(m.get("carbs")) * (target_carbs / sum_carbs))))
                new_f = max(2, int(round(_int(m.get("fat")) * (target_fat / sum_fat))))
            old_k = max(1, _int(m.get("calories")))
            if abs(new_k - old_k) / old_k > 0.05:
                copy["ingredients"] = _scale_ingredients(copy.get("ingredients") or [], new_k / old_k)

        if redistribute and is_last:
            new_k = max(80, target_kcal - running_k)
            new_p = max(2, target_prot - running_p)
            new_c = max(3, target_carbs - running_c)
            new_f = max(2, target_fat - running_f)

        copy["calories"] = int(new_k)
        copy["protein"] = int(new_p)
        copy["carbs"] = int(new_c)
        copy["fat"] = int(new_f)
        running_k += copy["calories"]
        running_p += copy["protein"]
        running_c += copy["carbs"]
        running_f += copy["fat"]
        fitted.append(copy)

    # Ajuste fino del último plato por redondeo
    if fitted:
        last = fitted[-1]
        last["calories"] = max(80, target_kcal - sum(m["calories"] for m in fitted[:-1]))
        last["protein"] = max(2, target_prot - sum(m["protein"] for m in fitted[:-1]))
        last["carbs"] = max(3, target_carbs - sum(m["carbs"] for m in fitted[:-1]))
        last["fat"] = max(2, target_fat - sum(m["fat"] for m in fitted[:-1]))
    return fitted


def _pick_best_recipe_for_slot(
    pool: List[dict], day_idx: int, slot_idx: int, target_kcal: int
) -> Optional[dict]:
    if not pool:
        return None
    scored = sorted(
        pool,
        key=lambda r: abs((_int(r.get("calories")) or target_kcal) - target_kcal),
    )
    # Variedad: entre las 3 más cercanas, rota por día
    top = scored[: min(3, len(scored))]
    return top[(day_idx + slot_idx) % len(top)]


def _fallback_week(context: Dict[str, Any]) -> dict:
    """Menú básico sin IA: combina recetas del catálogo o plantillas, ajustado a kcal."""
    kcal = int(context.get("target_calories") or 2000)
    prot = int(context.get("target_protein") or 80)
    carbs = int(context.get("target_carbs") or 250)
    fat = int(context.get("target_fat") or 70)
    slot_kcal = _slot_kcal_targets(kcal)
    slot_macros = _slot_macro_targets(prot, carbs, fat)

    recipes = context.get("recipe_catalog") or []
    by_slot: Dict[str, List[dict]] = {s["type"]: [] for s in MEAL_SLOTS}
    for r in recipes:
        cat = _norm(str(r.get("category") or ""))
        name = _norm(str(r.get("name") or ""))
        slot = "comida"
        if any(x in cat or x in name for x in ("desayuno", "breakfast", "avena", "huevo")):
            slot = "desayuno"
        elif any(x in cat or x in name for x in ("snack", "merienda", "fruta", "yogurt", "yogur")):
            slot = "merienda"
        elif any(x in cat or x in name for x in ("cena", "sopa", "ligero")):
            slot = "cena"
        elif any(x in cat or x in name for x in ("ensalada", "bebida", "almuerzo")):
            slot = "almuerzo"
        by_slot.setdefault(slot, []).append(r)

    templates = [
        ("Avena con fruta y yogur", "desayuno"),
        ("Fruta con almendras", "almuerzo"),
        ("Arroz con pollo y ensalada", "comida"),
        ("Yogur con granola", "merienda"),
        ("Sopa de verduras con huevo", "cena"),
    ]

    ingredients_catalog = context.get("ingredient_catalog") or []
    default_ings = [i.get("name") for i in ingredients_catalog[:8] if i.get("name")]

    days = []
    for d_idx, day in enumerate(DAYS_ES):
        meals = []
        for i, slot in enumerate(MEAL_SLOTS):
            st = slot["type"]
            mk = slot_kcal[st]
            mm = slot_macros[st]
            pool = by_slot.get(st) or []
            # También busca en todo el catálogo si el pool del slot está vacío
            r = _pick_best_recipe_for_slot(pool or recipes, d_idx, i, mk)
            if r:
                ings = r.get("ingredients") or []
                meals.append(
                    {
                        "type": st,
                        "recipe_id": r.get("id"),
                        "recipe_name": r.get("name") or f"Comida {st}",
                        "calories": mk,
                        "protein": mm["protein"],
                        "carbs": mm["carbs"],
                        "fat": mm["fat"],
                        "time": slot["time"],
                        "ingredients": _scale_ingredients(
                            [
                                {
                                    "name": (x if isinstance(x, str) else x.get("name", "")),
                                    "grams": (80 if isinstance(x, str) else _int(x.get("grams")) or 80),
                                }
                                for x in ings[:6]
                                if (isinstance(x, str) and x.strip())
                                or (isinstance(x, dict) and x.get("name"))
                            ]
                            or [{"name": n, "grams": 80} for n in default_ings[:3]],
                            mk / max(1, _int(r.get("calories")) or mk),
                        ),
                        "notes": "Generado automáticamente · porciones ajustadas al objetivo kcal",
                    }
                )
            else:
                name, _ = templates[i]
                meals.append(
                    {
                        "type": st,
                        "recipe_id": None,
                        "recipe_name": f"{name} ({day[:3]})",
                        "calories": mk,
                        "protein": mm["protein"],
                        "carbs": mm["carbs"],
                        "fat": mm["fat"],
                        "time": slot["time"],
                        "ingredients": [{"name": n, "grams": 80} for n in default_ings[:4]]
                        or [{"name": "Huevo de gallina", "grams": 50}],
                        "notes": "Generado automáticamente (sin IA)",
                    }
                )
        meals = _fit_day_to_targets(meals, kcal, prot, carbs, fat)
        days.append({"day": day, "meals": meals})

    plan_name = context.get("plan_name") or "Plan nutricional"
    patient = context.get("patient_name") or "paciente"
    return {
        "name": f"Menú auto — {patient or plan_name}"[:180],
        "description": f"Menú {kcal} kcal/día para {patient} (catálogo plataforma)",
        "category": context.get("category") or "Mantenimiento",
        "days": days,
    }


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
            "model": OPENAI_MENU_MODEL,
            "temperature": 0.35,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=150,
    )
    if resp.status_code >= 400:
        raise ValueError(f"OpenAI error {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return _extract_json(content)


def _normalize_ingredients(raw: Any, catalog_names: Optional[List[str]] = None) -> List[dict]:
    out: List[dict] = []
    if not isinstance(raw, list):
        return out
    catalog_by_norm = {_norm(n): n for n in (catalog_names or []) if n}

    for item in raw:
        name = ""
        grams = 80
        if isinstance(item, str):
            name = item.strip()
        elif isinstance(item, dict):
            name = str(item.get("name") or item.get("ingredient") or "").strip()
            grams = _int(item.get("grams") or item.get("g") or item.get("portion_grams")) or 80
        if not name:
            continue
        # Prefer exact catalog name
        matched = catalog_by_norm.get(_norm(name))
        if not matched and catalog_by_norm:
            for cn, original in catalog_by_norm.items():
                if _norm(name) in cn or cn in _norm(name):
                    matched = original
                    break
        out.append({"name": matched or name, "grams": max(10, grams)})
    return out[:8]


def _match_recipe(name: str, recipe_catalog: List[dict]) -> Optional[dict]:
    if not name or not recipe_catalog:
        return None
    target = _norm(name)
    for r in recipe_catalog:
        if _norm(str(r.get("name") or "")) == target:
            return r
    for r in recipe_catalog:
        rn = _norm(str(r.get("name") or ""))
        if target in rn or rn in target:
            return r
    return None


def _normalize_ai_menu(raw: dict, context: Dict[str, Any]) -> dict:
    days_out: List[dict] = []
    raw_days = raw.get("days") or []
    by_day = {str(d.get("day", "")).strip(): d for d in raw_days if isinstance(d, dict)}
    recipe_catalog = context.get("recipe_catalog") or []
    catalog_names = [i.get("name") for i in (context.get("ingredient_catalog") or []) if i.get("name")]
    # Also allow recipe ingredient names
    for r in recipe_catalog:
        for ing in r.get("ingredients") or []:
            if isinstance(ing, str) and ing.strip():
                catalog_names.append(ing.strip())
            elif isinstance(ing, dict) and ing.get("name"):
                catalog_names.append(str(ing["name"]).strip())

    daily_kcal = int(context.get("target_calories") or 2000)
    daily_prot = int(context.get("target_protein") or 80)
    daily_carbs = int(context.get("target_carbs") or 250)
    daily_fat = int(context.get("target_fat") or 70)
    slot_kcal = _slot_kcal_targets(daily_kcal)
    slot_macros = _slot_macro_targets(daily_prot, daily_carbs, daily_fat)

    for day_name in DAYS_ES:
        src = by_day.get(day_name) or {}
        meals_in = src.get("meals") if isinstance(src.get("meals"), list) else []
        meals_by_type = {
            str(m.get("type", "")).strip().lower(): m for m in meals_in if isinstance(m, dict)
        }
        meals_out = []
        for slot in MEAL_SLOTS:
            st = slot["type"]
            m = meals_by_type.get(st, {})
            recipe_name = str(m.get("recipe_name") or m.get("name") or f"Comida {st}").strip()
            matched = None
            rid = m.get("recipe_id")
            if rid:
                matched = next((r for r in recipe_catalog if r.get("id") == rid), None)
            if not matched:
                matched = _match_recipe(recipe_name, recipe_catalog)

            ingredients = _normalize_ingredients(m.get("ingredients"), catalog_names)
            planned_kcal = _int(m.get("calories")) or slot_kcal[st]
            planned_prot = _int(m.get("protein")) or slot_macros[st]["protein"]
            planned_carbs = _int(m.get("carbs")) or slot_macros[st]["carbs"]
            planned_fat = _int(m.get("fat")) or slot_macros[st]["fat"]

            if matched:
                recipe_name = matched.get("name") or recipe_name
                rid = matched.get("id")
                if not ingredients:
                    ingredients = _normalize_ingredients(matched.get("ingredients"), catalog_names)
                # NO reemplazar kcal del slot con las de la receta del catálogo
                # (esas suelen ser porciones fijas y desvían el menú del objetivo del paciente)
                catalog_kcal = _int(matched.get("calories"))
                if catalog_kcal > 0 and abs(catalog_kcal - planned_kcal) / max(planned_kcal, 1) > 0.25:
                    ingredients = _scale_ingredients(
                        ingredients, planned_kcal / catalog_kcal
                    )
                if planned_prot <= 0:
                    planned_prot = _int(matched.get("protein")) or slot_macros[st]["protein"]
                if planned_carbs <= 0:
                    planned_carbs = _int(matched.get("carbs")) or slot_macros[st]["carbs"]
                if planned_fat <= 0:
                    planned_fat = _int(matched.get("fat")) or slot_macros[st]["fat"]
            else:
                rid = None

            meals_out.append(
                {
                    "type": st,
                    "recipe_id": rid,
                    "recipe_name": recipe_name,
                    "calories": planned_kcal,
                    "protein": planned_prot,
                    "carbs": planned_carbs,
                    "fat": planned_fat,
                    "time": str(m.get("time") or slot["time"]),
                    "ingredients": ingredients,
                    "notes": str(m.get("notes") or "Generado con IA · ajustado a kcal del paciente"),
                    "image": (matched or {}).get("image"),
                }
            )
        meals_out = _fit_day_to_targets(meals_out, daily_kcal, daily_prot, daily_carbs, daily_fat)
        days_out.append({"day": day_name, "meals": meals_out})

    patient = context.get("patient_name") or "paciente"
    return {
        "name": str(raw.get("name") or f"Menú IA — {patient}")[:200],
        "description": str(
            raw.get("description")
            or f"Menú semanal con ingredientes de la plataforma para {patient} ({daily_kcal} kcal/día)"
        )[:500],
        "category": str(raw.get("category") or context.get("category") or "Mantenimiento"),
        "days": days_out,
    }


def build_n_week_payload(days_week1: List[dict], weeks: int = 4) -> List[dict]:
    """Expande 7 días a N semanas (1–4). Varía ligeramente el nombre en semanas 2+."""
    n = max(1, min(4, int(weeks or 4)))
    week_payload: List[dict] = []
    for week_num in range(1, n + 1):
        for day_block in days_week1:
            meals = []
            for meal in day_block.get("meals", []):
                copy = dict(meal)
                if week_num > 1 and copy.get("recipe_name") and not copy.get("recipe_id"):
                    copy["recipe_name"] = f"{copy['recipe_name']} (S{week_num})"
                meals.append(copy)
            week_payload.append(
                {
                    "day": day_block["day"],
                    "week": week_num,
                    "meals": meals,
                }
            )
    return week_payload


def build_four_week_payload(days_week1: List[dict]) -> List[dict]:
    """Compat: expande a 4 semanas."""
    return build_n_week_payload(days_week1, 4)


def _format_catalog_for_prompt(context: Dict[str, Any]) -> str:
    parts: List[str] = []
    recipes = context.get("recipe_catalog") or []
    if recipes:
        lines = []
        for r in recipes[:40]:
            ings = r.get("ingredients") or []
            ing_names = []
            for x in ings[:5]:
                if isinstance(x, str):
                    ing_names.append(x)
                elif isinstance(x, dict) and x.get("name"):
                    ing_names.append(str(x["name"]))
            ing_txt = f" | ings: {', '.join(ing_names)}" if ing_names else ""
            lines.append(
                f"- id={r.get('id')} | {r.get('name')} | {r.get('calories', 0)} kcal | "
                f"P{r.get('protein', 0)} C{r.get('carbs', 0)} G{r.get('fat', 0)} | "
                f"cat={r.get('category') or '-'}{ing_txt}"
            )
        parts.append("RECETAS DE LA PLATAFORMA (prioriza recipe_id):\n" + "\n".join(lines))

    ingredients = context.get("ingredient_catalog") or []
    if ingredients:
        lines = []
        for i in ingredients[:60]:
            lines.append(
                f"- {i.get('name')} | {i.get('kcal', 0)} kcal/porción ref | "
                f"P{i.get('prot', 0)} C{i.get('chos', 0)} G{i.get('grasa', 0)}"
            )
        parts.append(
            "INGREDIENTES / GRUPOS EVANUT DE LA PLATAFORMA (usa estos nombres):\n" + "\n".join(lines)
        )
    return "\n\n".join(parts)


def generate_weekly_menu_ai(context: Dict[str, Any]) -> dict:
    """
    Genera estructura de menú semanal (metadata + days semana 1).
    context: plan_name, target_calories, target_protein, target_carbs, target_fat,
             category, patient_name, patient_notes, recipe_catalog, ingredient_catalog,
             patient_kcal_source
    """
    if not is_weekly_menu_ai_enabled():
        return _fallback_week(context)

    catalog_txt = _format_catalog_for_prompt(context)
    if not catalog_txt:
        catalog_txt = "(Catálogo vacío: usa alimentos colombianos comunes y avisa en notes)"

    kcal_src = context.get("patient_kcal_source") or "plan"
    daily_kcal = int(context.get("target_calories") or 2000)
    daily_prot = int(context.get("target_protein") or 80)
    daily_carbs = int(context.get("target_carbs") or 250)
    daily_fat = int(context.get("target_fat") or 70)
    slot_kcal = _slot_kcal_targets(daily_kcal)
    user_prompt = f"""Genera un menú semanal personalizado:

OBJETIVO CALÓRICO DEL PACIENTE (prioridad máxima — OBLIGATORIO):
- Calorías/día: {daily_kcal} kcal (la suma de las 5 comidas de CADA día = {daily_kcal})
- Fuente del objetivo: {kcal_src}
- Proteína/día: {daily_prot} g
- Carbohidratos/día: {daily_carbs} g
- Grasa/día: {daily_fat} g

PRESUPUESTO KCAL POR COMIDA (respétalo ±10%):
- desayuno: {slot_kcal['desayuno']} kcal
- almuerzo (snack AM): {slot_kcal['almuerzo']} kcal
- comida (almuerzo principal): {slot_kcal['comida']} kcal
- merienda (snack PM): {slot_kcal['merienda']} kcal
- cena: {slot_kcal['cena']} kcal

PACIENTE:
- Nombre: {context.get('patient_name') or 'Adulto'}
- Peso actual: {context.get('patient_weight') or 'N/D'} kg
- Altura: {context.get('patient_height') or 'N/D'} cm
- Objetivo de peso: {context.get('patient_goal_weight') or 'N/D'} kg
- Actividad: {context.get('patient_activity') or 'N/D'}
- Preferencias: {context.get('patient_preferences') or 'N/D'}
- Alergias: {context.get('patient_allergies') or 'Ninguna'}
- RECHAZOS / DISGUSTOS ALIMENTICIOS (NO uses estos alimentos): {context.get('patient_food_rejections') or context.get('patient_notes') or 'Ninguno'}
- Otras notas clínicas: {context.get('patient_notes') or 'Ninguna'}

INSTRUCCIONES DEL NUTRICIONISTA (prioridad alta):
{context.get('nutritionist_instructions') or 'Ninguna adicional'}

CONTEXTO:
- Semanas a cubrir: {context.get('weeks') or 1} (genera la semana base; se expandirá)
- Categoría preferida: {context.get('category') or 'Mantenimiento'}
- Plan de referencia: {context.get('plan_name') or 'Según última info del paciente'}

{catalog_txt}

Importante:
- PROHIBIDO incluir alimentos de la lista de rechazos/disgustos/alergias.
- Arma cada comida con ingredientes del catálogo (y recipe_id solo si la receta está cerca del presupuesto del slot).
- Ajusta gramos de ingredientes para que calories por comida coincida con el presupuesto.
- Cada día debe sumar exactamente {daily_kcal} kcal (±3%).
- Respeta las instrucciones del nutricionista.
"""
    raw = _call_openai(user_prompt)
    return _normalize_ai_menu(raw, context)


def week_dict_from_payload(week_payload: List[dict]) -> Dict[str, List]:
    """Convierte payload plano a columnas monday..sunday (listas de 4 semanas)."""
    days_map = {
        "Lunes": "monday",
        "Martes": "tuesday",
        "Miércoles": "wednesday",
        "Jueves": "thursday",
        "Viernes": "friday",
        "Sábado": "saturday",
        "Domingo": "sunday",
    }
    week_dict = {v: [{}, {}, {}, {}] for v in days_map.values()}
    for item in week_payload:
        key = days_map.get(item.get("day", ""))
        if not key:
            continue
        week_idx = max(0, min(3, int(item.get("week") or 1) - 1))
        week_dict[key][week_idx] = {"meals": item.get("meals") or []}
    return week_dict
