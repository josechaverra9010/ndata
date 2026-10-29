"""Análisis nutricional de fotos de comida con visión por IA (OpenAI)."""
from __future__ import annotations

import base64
import json
import os
import re
from typing import Any, Dict, List, Optional

import requests

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_VISION_MODEL = os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini").strip()

SYSTEM_PROMPT = """Eres un nutricionista clínico especializado en estimación de porciones desde fotografías.
Analiza la imagen del plato, identifica cada alimento visible y estima macronutrientes.
Responde ÚNICAMENTE con JSON válido (sin markdown ni texto extra) con esta estructura:
{
  "description": "descripción breve del plato en español",
  "foods": [
    {
      "name": "nombre del alimento",
      "portion_size": "ej. 120 g o 1 taza",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "confidence": 0.0
    }
  ],
  "totals": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
  "notes": "limitaciones de la estimación visual"
}
Reglas:
- calories, protein, carbs, fat: enteros (gramos para macros, kcal para calorías)
- confidence: número entre 0 y 1 por alimento
- totals debe ser la suma de foods
- Si no hay comida visible, foods=[] y notes explicando por qué
- Contexto: paciente en Colombia, porciones caseras habituales"""


def _mime_from_ext(ext: str) -> str:
    ext = (ext or "").lower()
    if ext in (".png",):
        return "image/png"
    if ext in (".webp",):
        return "image/webp"
    if ext in (".gif",):
        return "image/gif"
    return "image/jpeg"


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        raise ValueError("Respuesta vacía del modelo de visión")
    # Quitar fences markdown si vienen
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


def _sanitize_food(item: dict) -> dict:
    def _int(v: Any) -> int:
        try:
            return max(0, int(round(float(v))))
        except (TypeError, ValueError):
            return 0

    def _conf(v: Any) -> float:
        try:
            c = float(v)
            return max(0.0, min(1.0, c))
        except (TypeError, ValueError):
            return 0.5

    name = str(item.get("name") or "Alimento detectado").strip()[:120]
    portion = str(item.get("portion_size") or "1 porción").strip()[:80]
    return {
        "name": name or "Alimento detectado",
        "portion_size": portion or "1 porción",
        "calories": _int(item.get("calories")),
        "protein": _int(item.get("protein")),
        "carbs": _int(item.get("carbs")),
        "fat": _int(item.get("fat")),
        "confidence": _conf(item.get("confidence")),
    }


def normalize_meal_analysis(raw: dict) -> dict:
    foods_in = raw.get("foods") if isinstance(raw.get("foods"), list) else []
    foods: List[dict] = [_sanitize_food(f) for f in foods_in if isinstance(f, dict)]

    totals_raw = raw.get("totals") if isinstance(raw.get("totals"), dict) else {}
    if foods:
        totals = {
            "calories": sum(f["calories"] for f in foods),
            "protein": sum(f["protein"] for f in foods),
            "carbs": sum(f["carbs"] for f in foods),
            "fat": sum(f["fat"] for f in foods),
        }
    else:
        totals = {
            "calories": max(0, int(float(totals_raw.get("calories") or 0))),
            "protein": max(0, int(float(totals_raw.get("protein") or 0))),
            "carbs": max(0, int(float(totals_raw.get("carbs") or 0))),
            "fat": max(0, int(float(totals_raw.get("fat") or 0))),
        }

    return {
        "description": str(raw.get("description") or "").strip()[:500],
        "foods": foods,
        "totals": totals,
        "notes": str(raw.get("notes") or "Estimación aproximada basada en la imagen.").strip()[:500],
        "provider": "openai",
        "model": OPENAI_VISION_MODEL,
    }


def analyze_meal_image(image_bytes: bytes, file_ext: str = ".jpg") -> dict:
    """Analiza una foto de comida y devuelve alimentos + macros estimados."""
    if not OPENAI_API_KEY:
        raise ValueError(
            "El análisis por foto no está configurado. Agrega OPENAI_API_KEY en el servidor."
        )
    if not image_bytes:
        raise ValueError("Imagen vacía")
    if len(image_bytes) > 5 * 1024 * 1024:
        raise ValueError("Imagen demasiado grande (máx. 5MB)")

    mime = _mime_from_ext(file_ext)
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime};base64,{b64}"

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": OPENAI_VISION_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Analiza esta foto de comida. "
                                "Estima calorías, proteínas, carbohidratos y grasas por alimento visible."
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url, "detail": "low"},
                        },
                    ],
                },
            ],
            "max_tokens": 1400,
            "temperature": 0.2,
        },
        timeout=90,
    )

    if response.status_code != 200:
        detail = response.text[:300]
        raise ValueError(f"Error del servicio de visión ({response.status_code}): {detail}")

    payload = response.json()
    choices = payload.get("choices") or []
    if not choices:
        raise ValueError("Sin respuesta del modelo de visión")

    content = choices[0].get("message", {}).get("content", "")
    parsed = _extract_json(content)
    return normalize_meal_analysis(parsed)


def is_meal_vision_enabled() -> bool:
    return bool(OPENAI_API_KEY)
