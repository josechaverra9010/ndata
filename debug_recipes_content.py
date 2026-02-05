
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "mysql+pymysql://root@localhost/ndata"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, name, ingredients, instructions FROM recipes LIMIT 5"))
        with open("recipes_debug_log.txt", "w", encoding="utf-8") as f:
            f.write(f"{'ID':<5} {'Name':<30} {'Ingredients Type':<20} {'Instructions Type':<20}\n")
            f.write("-" * 80 + "\n")
            for row in result:
                ing = row.ingredients
                ins = row.instructions
                f.write(f"{row.id:<5} {row.name[:30]:<30} {type(ing)} {type(ins)}\n")
                f.write(f"  Ingredients: {repr(ing)}\n")
                f.write(f"  Instructions: {repr(ins)}\n\n")
        print("Done writing to recipes_debug_log.txt")
except Exception as e:
    print(f"Error: {e}")
