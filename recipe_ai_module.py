"""Generación de recetas con IA (OpenAI)."""
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

import requests

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_RECIPE_MODEL = os.getenv(
    "OPENAI_RECIPE_MODEL",
    os.getenv("OPENAI_MENU_MODEL", os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini")),
).strip()

RECIPE_CATEGORIES = [
    "Desayunos",
    "Ensaladas",
    "Platos principales",
    "Bebidas",
    "Snacks",
    "Postres",
]

SYSTEM_PROMPT = """Eres un nutricionista dietista colombiano experto en cocina saludable y composición de alimentos.
Generas UNA receta completa, práctica y realista para el contexto clínico / consulta nutricional.
Responde ÚNICAMENTE JSON válido (sin markdown) con esta estructura exacta:
{
  "name": "nombre corto de la receta",
  "description": "descripción breve 1-2 frases",
  "category": "Desayunos|Ensaladas|Platos principales|Bebidas|Snacks|Postres",
  "prepTime": 10,
  "cookTime": 15,
  "servings": 2,
  "calories": 350,
  "protein": 20,
  "carbs": 40,
  "fat": 12,
  "ingredients": [
    {"name": "nombre del alimento (preferible nombres de tabla colombiana)", "grams": 100, "note": "opcional"}
  ],
  "instructions": ["paso 1", "paso 2", "paso 3"],
  "tags": ["etiqueta1", "etiqueta2"]
}
Reglas:
- Usa alimentos típicos de Colombia y medidas en gramos
- ingredients: entre 3 y 12 ítems; name en español, concreto (ej. "Pollo crudo sin piel", "Arroz blanco cocido", "Tomate chonto", "Huevo de gallina crudo")
- calories/protein/carbs/fat: enteros estimados POR PORCIÓN (por 1 serving)
- CRÍTICO: si te indican un objetivo de calorías por porción, calories DEBE ser ese valor (±5%). Ajusta gramos de ingredientes para lograrlo.
- prepTime y cookTime en minutos enteros
- servings entre 1 y 8
- instructions: pasos claros, uno por elemento del array
- tags: 2 a 5 etiquetas cortas
- Si hay restricciones (alergias, vegetariano, etc.) respétalas estrictamente
- No inventes ingredientes exóticos difíciles de conseguir en Colombia"""


def is_recipe_ai_enabled() -> bool:
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


def _int(v: Any, default: int = 0) -> int:
    try:
        return max(0, int(round(float(v))))
    except (TypeError, ValueError):
        return default


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
            "model": OPENAI_RECIPE_MODEL,
            "temperature": 0.4,
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
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return _extract_json(content)


def _normalize_ingredients(raw: Any) -> List[dict]:
    out: List[dict] = []
    if not isinstance(raw, list):
        return out
    for item in raw:
        if isinstance(item, str) and item.strip():
            out.append({"name": item.strip(), "grams": None, "note": ""})
            continue
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or item.get("ingredient") or item.get("alimento") or "").strip()
        if not name:
            continue
        grams = item.get("grams")
        if grams is None:
            grams = item.get("g") or item.get("cantidad_g")
        try:
            grams_val = float(grams) if grams is not None else None
        except (TypeError, ValueError):
            grams_val = None
        out.append(
            {
                "name": name,
                "grams": grams_val,
                "note": str(item.get("note") or item.get("nota") or "").strip(),
            }
        )
    return out[:12]


def _default_macros_for_kcal(kcal: int) -> Dict[str, int]:
    """Reparto ~20% prot / 50% CHO / 30% grasa."""
    k = max(80, int(kcal or 350))
    return {
        "protein": max(4, int(round(k * 0.20 / 4))),
        "carbs": max(8, int(round(k * 0.50 / 4))),
        "fat": max(3, int(round(k * 0.30 / 9))),
    }


def _fit_recipe_to_target(recipe: dict, target_kcal: Optional[int]) -> dict:
    """Fuerza calories (y macros/gramos) al objetivo indicado."""
    if not target_kcal:
        return recipe
    try:
        target = int(target_kcal)
    except (TypeError, ValueError):
        return recipe
    if target < 80:
        return recipe

    current = _int(recipe.get("calories"), 0)
    defaults = _default_macros_for_kcal(target)

    if current <= 0:
        recipe["calories"] = target
        recipe["protein"] = _int(recipe.get("protein"), 0) or defaults["protein"]
        recipe["carbs"] = _int(recipe.get("carbs"), 0) or defaults["carbs"]
        recipe["fat"] = _int(recipe.get("fat"), 0) or defaults["fat"]
        return recipe

    factor = target / current
    # Si ya está dentro de ±5%, solo corrige el número de calories
    if 0.95 <= factor <= 1.05:
        recipe["calories"] = target
        if _int(recipe.get("protein"), 0) <= 0:
            recipe["protein"] = defaults["protein"]
        if _int(recipe.get("carbs"), 0) <= 0:
            recipe["carbs"] = defaults["carbs"]
        if _int(recipe.get("fat"), 0) <= 0:
            recipe["fat"] = defaults["fat"]
        return recipe

    factor = max(0.35, min(3.0, factor))
    recipe["calories"] = target
    recipe["protein"] = max(2, int(round(_int(recipe.get("protein"), defaults["protein"]) * factor)))
    recipe["carbs"] = max(3, int(round(_int(recipe.get("carbs"), defaults["carbs"]) * factor)))
    recipe["fat"] = max(2, int(round(_int(recipe.get("fat"), defaults["fat"]) * factor)))

    scaled_ings = []
    for ing in recipe.get("ingredients") or []:
        copy = dict(ing)
        grams = copy.get("grams")
        try:
            g = float(grams) if grams is not None else None
        except (TypeError, ValueError):
            g = None
        if g is not None and g > 0:
            copy["grams"] = max(5, round(g * factor, 1))
        scaled_ings.append(copy)
    recipe["ingredients"] = scaled_ings
    return recipe


def _normalize_recipe(raw: dict, context: Dict[str, Any]) -> dict:
    category = str(raw.get("category") or context.get("category") or "Platos principales").strip()
    if category not in RECIPE_CATEGORIES:
        # mapear aproximaciones
        low = category.lower()
        if "desay" in low:
            category = "Desayunos"
        elif "ensalad" in low:
            category = "Ensaladas"
        elif "bebid" in low or "jugo" in low:
            category = "Bebidas"
        elif "snack" in low or "meriend" in low:
            category = "Snacks"
        elif "postre" in low or "dulce" in low:
            category = "Postres"
        else:
            category = "Platos principales"

    instructions = raw.get("instructions") or raw.get("pasos") or []
    if isinstance(instructions, str):
        instructions = [ln.strip() for ln in instructions.split("\n") if ln.strip()]
    elif isinstance(instructions, list):
        instructions = [str(x).strip() for x in instructions if str(x).strip()]
    else:
        instructions = []

    tags = raw.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    elif isinstance(tags, list):
        tags = [str(t).strip() for t in tags if str(t).strip()]
    else:
        tags = []

    ingredients = _normalize_ingredients(raw.get("ingredients") or raw.get("ingredientes"))

    name = str(raw.get("name") or raw.get("nombre") or context.get("idea") or "Receta generada").strip()
    description = str(raw.get("description") or raw.get("descripcion") or "").strip()

    recipe = {
        "name": name[:200],
        "description": description[:800],
        "category": category,
        "prepTime": _int(raw.get("prepTime") or raw.get("prep_time"), 10),
        "cookTime": _int(raw.get("cookTime") or raw.get("cook_time"), 15),
        "servings": max(1, min(8, _int(raw.get("servings") or raw.get("porciones"), 2))),
        "calories": _int(raw.get("calories") or raw.get("kcal"), 0),
        "protein": _int(raw.get("protein") or raw.get("proteina"), 0),
        "carbs": _int(raw.get("carbs") or raw.get("carbohidratos") or raw.get("chos"), 0),
        "fat": _int(raw.get("fat") or raw.get("grasas") or raw.get("grasa"), 0),
        "ingredients": ingredients,
        "instructions": instructions[:20] or ["Preparar ingredientes.", "Cocinar según técnica.", "Servir."],
        "tags": (tags or ["ia", "nutridata"])[:8],
        "ai_generated": True,
    }
    return _fit_recipe_to_target(recipe, context.get("target_calories"))


def _fallback_recipe(context: Dict[str, Any]) -> dict:
    idea = (context.get("idea") or "Pollo con verduras").strip()
    category = context.get("category") or "Platos principales"
    target = int(context.get("target_calories") or 400)
    macros = _default_macros_for_kcal(target)
    base_kcal = 400
    factor = max(0.35, min(3.0, target / base_kcal))
    recipe = {
        "name": idea[:200],
        "description": f"Borrador automático (sin IA) basado en: {idea}",
        "category": category if category in RECIPE_CATEGORIES else "Platos principales",
        "prepTime": 15,
        "cookTime": 20,
        "servings": max(1, min(8, int(context.get("servings") or 2))),
        "calories": target,
        "protein": macros["protein"],
        "carbs": macros["carbs"],
        "fat": macros["fat"],
        "ingredients": [
            {"name": "Pollo crudo sin piel", "grams": max(40, round(120 * factor)), "note": ""},
            {"name": "Arroz blanco cocido", "grams": max(40, round(100 * factor)), "note": ""},
            {"name": "Tomate chonto", "grams": max(30, round(80 * factor)), "note": ""},
            {"name": "Cebolla cabezona blanca", "grams": max(20, round(40 * factor)), "note": ""},
            {"name": "Aceite de oliva", "grams": max(5, round(10 * factor)), "note": ""},
        ],
        "instructions": [
            "Lavar y picar verduras.",
            "Saltear el pollo hasta dorar.",
            "Agregar verduras y cocinar 8-10 minutos.",
            "Servir con arroz.",
        ],
        "tags": ["borrador", "sin-ia"],
        "ai_generated": False,
    }
    return recipe


def generate_recipe_ai(context: Dict[str, Any]) -> dict:
    """Genera una receta. Usa OpenAI si hay API key; si no, borrador local."""
    idea = str(context.get("idea") or "").strip()
    if not idea:
        raise ValueError("Indica una idea o descripción para la receta")

    if not OPENAI_API_KEY:
        return _fallback_recipe(context)

    parts = [
        f"Idea / pedido del nutricionista: {idea}",
        f"Categoría preferida: {context.get('category') or 'Platos principales'}",
    ]
    if context.get("target_calories"):
        parts.append(
            f"OBJETIVO OBLIGATORIO: exactamente {context['target_calories']} kcal POR PORCIÓN "
            f"(±5%). Ajusta gramos de cada ingrediente para lograrlo. "
            f"El campo calories del JSON debe ser {context['target_calories']}."
        )
    if context.get("servings"):
        parts.append(f"Porciones: {context['servings']}")
    if context.get("restrictions"):
        parts.append(f"Restricciones / preferencias: {context['restrictions']}")
    if context.get("meal_moment"):
        parts.append(f"Momento de comida: {context['meal_moment']}")
    if context.get("catalog_hints"):
        hints = context["catalog_hints"]
        if isinstance(hints, list) and hints:
            parts.append(
                "Prioriza estos nombres de alimentos del catálogo NutriData cuando sea posible: "
                + ", ".join(str(h) for h in hints[:80])
            )

    user_prompt = "\n".join(parts)
    raw = _call_openai(user_prompt)
    return _normalize_recipe(raw, {**context, "idea": idea})
