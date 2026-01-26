
import json
import os

with open(r"c:\Users\Victus\ndata\excel_content.json", "r", encoding="utf-8") as f:
    content = json.load(f)

print(f"Sheet names: {list(content.keys())}")
sheet = content.get("F. Desarrollada", [])
print(f"Number of rows in 'F. Desarrollada': {len(sheet)}")

if len(sheet) > 2:
    print(f"Row 2 (headers): {sheet[1]}")
    print(f"Row 3 (first data): {sheet[2]}")

nutrient_data = {}
for i, row in enumerate(sheet[2:]):
    if len(row) > 2:
        name = str(row[0]).strip() if row[0] else ""
        kcal = row[3] if len(row) > 3 else None # WAIT, let's check index
        print(f"R{i+3}: name='{name}', kcal={row[2]}")
        
    if row[0] and row[2] is not None:
        name = str(row[0]).strip()
        nutrients = {
            "kcal": row[2],
            "prot": row[3],
            "grasa": row[4],
            "gs": row[5],
            "gm": row[6],
            "gp": row[7],
            "col": row[8],
            "chos": row[9],
            "fd": row[10]
        }
        # Add mineraies if available
        if len(row) > 11: nutrients["calcio"] = row[11]
        if len(row) > 12: nutrients["p"] = row[12]
        if len(row) > 13: nutrients["fe"] = row[13]
        if len(row) > 14: nutrients["na"] = row[14]
        if len(row) > 15: nutrients["k"] = row[15]
        if len(row) > 16: nutrients["mg"] = row[16]
        if len(row) > 17: nutrients["zn"] = row[17]
        if len(row) > 18: nutrients["cu"] = row[18]
        
        nutrient_data[name] = nutrients

print(f"Total extracted: {len(nutrient_data)}")
