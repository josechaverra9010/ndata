
import json
import os

with open(r"c:\Users\Victus\ndata\excel_content.json", "r", encoding="utf-8") as f:
    content = json.load(f)

sheets_to_print = ["Adulto", "F. Desarrollada"]

output_file = r"c:\Users\Victus\ndata\excel_summary.txt"

with open(output_file, "w", encoding="utf-8") as f:
    for sheetname in sheets_to_print:
        f.write(f"=== SHEET: {sheetname} ===\n")
        sheet = content.get(sheetname, [])
        for row_idx, row in enumerate(sheet):
            # Format row as pipe-separated string
            row_str = " | ".join([str(c) if c is not None else "" for c in row])
            f.write(f"R{row_idx+1}: {row_str}\n")
        f.write("\n")

print(f"Summary written to {output_file}")
