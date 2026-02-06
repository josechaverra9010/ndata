
import json

def to_list(val):
    if val is None:
        return []
    if isinstance(val, (list, tuple)):
        return list(val)
    if isinstance(val, str):
        try:
            p = json.loads(val)
            result = list(p) if isinstance(p, (list, tuple)) else []
            return result
        except (json.JSONDecodeError, TypeError) as e:
            print(f"JSON Error for '{val}': {e}")
            return []
    return []

# Data from my debug log
data = [
    '["Huevos", "Cebolla", "Tomate", "Espinaca", "Aceite de oliva", "Sal"]',
    '["Batir los huevos", "Sofre\\u00edr cebolla y tomate", "Agregar espinaca", "A\\u00f1adir los huevos y cocinar"]',
    '["Arepa de ma\\u00edz", "Huevo", "Aceite", "Sal"]'
]

for item in data:
    result = to_list(item)
    print(f"Input: {item[:30]}... -> Type: {type(result)} -> Content: {result}")
