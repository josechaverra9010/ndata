# -*- coding: utf-8 -*-
"""
Sincroniza los datos de foodNutrients.ts con la Lista de intercambio (PDF/Excel).
Lee food_nutrients.json (generado desde excel_content.json / F. Desarrollada)
y actualiza en foodNutrients.ts solo las entradas que coinciden por nombre,
dejando el resto del archivo igual.
"""
import json
import re
import os

BASE = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(BASE, "food_nutrients.json")
TS_PATH = os.path.join(BASE, "src", "lib", "foodNutrients.ts")

with open(JSON_PATH, "r", encoding="utf-8") as f:
    lista_data = json.load(f)

with open(TS_PATH, "r", encoding="utf-8") as f:
    ts_content = f.read()

def format_entry(key: str, data: dict) -> str:
    lines = [f'  "{key}": {{']
    for k, v in data.items():
        if isinstance(v, float):
            if v == int(v):
                lines.append(f'    "{k}": {int(v)},')
            else:
                lines.append(f'    "{k}": {v},')
        else:
            lines.append(f'    "{k}": {v},')
    lines.append("  }")
    return "\n".join(lines)

# Encontrar el objeto FOOD_NUTRIENTS: desde "export const FOOD_NUTRIENTS" hasta "};" que cierra el Record
start_marker = "export const FOOD_NUTRIENTS: Record<string, NutrientData> = {"
end_marker = "};"

start_idx = ts_content.find(start_marker)
if start_idx == -1:
    raise SystemExit("No se encontró FOOD_NUTRIENTS en el TS")
start_idx += len(start_marker)
# Buscar el cierre del objeto (primera "};" que coincide con el nivel de llaves)
depth = 1
i = start_idx
while i < len(ts_content) and depth > 0:
    if ts_content[i:i+2] == "};" and depth == 1:
        break
    if ts_content[i] == "{":
        depth += 1
    elif ts_content[i] == "}":
        depth -= 1
    i += 1
end_idx = i  # no incluir "};"
body = ts_content[start_idx:end_idx]

# Encontrar cada clave de lista_data en body y reemplazar su bloque (de atrás hacia adelante)
replacements = []
for key, data in lista_data.items():
    idx = body.find(f'"{key}":')
    if idx == -1:
        continue
    brace_start = body.index("{", idx)
    depth = 1
    j = brace_start + 1
    while j < len(body) and depth > 0:
        if body[j] == "{":
            depth += 1
        elif body[j] == "}":
            depth -= 1
        j += 1
    # No añadir coma: body[j:] ya contiene ",\n" tras la llave de cierre
    new_block = format_entry(key, data)
    replacements.append((idx, j, new_block))

# Aplicar de atrás hacia adelante para no desalinear índices
for idx, j, new_block in sorted(replacements, key=lambda x: -x[0]):
    body = body[:idx] + new_block + body[j:]

new_content = ts_content[:start_idx] + body + ts_content[end_idx:]

with open(TS_PATH, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"Actualizadas {len(lista_data)} entradas de la Lista de intercambio en foodNutrients.ts")
