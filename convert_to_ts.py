
import json

with open(r"c:\Users\Victus\ndata\food_nutrients.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Sort alphabetically by name
sorted_keys = sorted(data.keys())
sorted_data = {k: data[k] for k in sorted_keys}

with open(r"c:\Users\Victus\ndata\src\lib\foodNutrients.ts", "w", encoding="utf-8") as f:
    f.write("export interface NutrientData {\n")
    f.write("  kcal: number;\n")
    f.write("  prot: number;\n")
    f.write("  grasa: number;\n")
    f.write("  gs: number;\n")
    f.write("  gm: number;\n")
    f.write("  gp: number;\n")
    f.write("  col: number;\n")
    f.write("  chos: number;\n")
    f.write("  fd: number;\n")
    f.write("  calcio?: number;\n")
    f.write("  p?: number;\n")
    f.write("  fe?: number;\n")
    f.write("  na?: number;\n")
    f.write("  k?: number;\n")
    f.write("  mg?: number;\n")
    f.write("  zn?: number;\n")
    f.write("  cu?: number;\n")
    f.write("}\n\n")
    f.write("export const FOOD_NUTRIENTS: Record<string, NutrientData> = ")
    json.dump(sorted_data, f, indent=2, ensure_ascii=False)
    f.write(";\n")

print("Created src/lib/foodNutrients.ts")
