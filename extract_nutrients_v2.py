
import json
import os

with open(r"c:\Users\Victus\ndata\excel_content.json", "r", encoding="utf-8") as f:
    content = json.load(f)

for sheet_name in ["F. Desarrollada", "Adulto"]: # F. Desarrollada has more minerals
    sheet = content.get(sheet_name, [])
    
    # Find heades row
    header_idx = -1
    for i, row in enumerate(sheet):
        if any(cell and str(cell).strip() == "Grupo de alimentos" for cell in row):
            header_idx = i
            break
    
    if header_idx != -1:
        print(f"Found headers in '{sheet_name}' at row {header_idx + 1}")
        headers = sheet[header_idx]
        # Normalize headers
        headers = [str(h).strip() if h else "" for h in headers]
        
        nutrient_data = {}
        for row in sheet[header_idx + 1:]:
            # Find the index of "Grupo de alimentos"
            name_col = headers.index("Grupo de alimentos")
            name = str(row[name_col]).strip() if row[name_col] else ""
            
            if not name or "Total" in name or "Grupo" in name:
                continue
                
            # Map nutrients
            nutrients = {}
            mapping = {
                "Kcal": "kcal",
                "Prot": "prot",
                "Grasa": "grasa",
                "GS": "gs",
                "GM": "gm",
                "GP": "gp",
                "COL": "col",
                "CHOS": "chos",
                "FD": "fd",
                "Calcio (mg)": "calcio",
                "P (mg)": "p",
                "Fe (mg)": "fe",
                "Na (mg)": "na",
                "K (mg)": "k",
                "Mg (mg)": "mg",
                "Zn (mg)": "zn",
                "Cu (mg)": "cu"
            }
            
            for h_name, key in mapping.items():
                if h_name in headers:
                    idx = headers.index(h_name)
                    if idx < len(row):
                        val = row[idx]
                        try:
                            nutrients[key] = float(val) if val is not None else 0.0
                        except:
                            nutrients[key] = 0.0
            
            if nutrients.get("kcal") or nutrients.get("prot") or nutrients.get("grasa"):
                nutrient_data[name] = nutrients
        
        # Save results
        with open(r"c:\Users\Victus\ndata\food_nutrients.json", "w", encoding="utf-8") as f:
            json.dump(nutrient_data, f, indent=2, ensure_ascii=False)
        print(f"Extracted {len(nutrient_data)} food groups from {sheet_name}.")
        break
