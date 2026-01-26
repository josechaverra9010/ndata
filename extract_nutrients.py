
import json

with open(r"c:\Users\Victus\ndata\excel_content.json", "r", encoding="utf-8") as f:
    content = json.load(f)

sheet = content.get("F. Desarrollada", [])

# Skip headers (R1, R2)
# Data starts from R3
nutrient_data = {}
for row in sheet[2:]:
    if row[0] and row[2] is not None: # Name and Kcal must exist
        name = str(row[0]).strip()
        # Row structure: Name (0), Porciones (1 - empty), Kcal (2), Prot (3), Grasa (4), GS (5), GM (6), GP (7), COL (8), CHOS (9), FD (10), 
        # Calcio (11), P (12), Fe (13), Na (14), K (15), Mg (16), Zn (17), Cu (18)
        nutrients = {
            "kcal": row[2],
            "prot": row[3],
            "grasa": row[4],
            "gs": row[5],
            "gm": row[6],
            "gp": row[7],
            "col": row[8],
            "chos": row[9],
            "fd": row[10],
            "calcio": row[11],
            "p": row[12],
            "fe": row[13],
            "na": row[14],
            "k": row[15],
            "mg": row[16],
            "zn": row[17],
            "cu": row[18]
        }
        nutrient_data[name] = nutrients

with open(r"c:\Users\Victus\ndata\food_nutrients.json", "w", encoding="utf-8") as f:
    json.dump(nutrient_data, f, indent=2, ensure_ascii=False)

print(f"Extracted {len(nutrient_data)} food groups.")
