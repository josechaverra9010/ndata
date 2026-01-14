from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "mysql+pymysql://root@localhost/ndata"

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def diagnose():
    with open("diag_output_v5.txt", "w") as f:
        with engine.connect() as conn:
            tables = ['users', 'progress_metrics', 'meal_food_items', 'recipes', 'meal_plans']
            
            for table in tables:
                f.write(f"\n--- Schema for table '{table}' ---\n")
                try:
                    res = conn.execute(text(f"DESCRIBE {table}"))
                    for row in res:
                        f.write(str(row) + "\n")
                except Exception as e:
                    f.write(f"Table '{table}' not found or error: {e}\n")
                
            tables_cols = {
                'users': ['altura', 'peso_actual', 'peso_objetivo', 'peso_inicial'],
                'progress_metrics': ['weight', 'body_fat', 'muscle', 'water', 'waist', 'hip', 'chest', 'arm'],
                'meal_food_items': ['protein', 'carbs', 'fat'],
                'recipes': ['calories', 'protein', 'carbs', 'fat'],
                'meal_plans': ['calories', 'protein_target', 'carbs_target', 'fat_target']
            }
            
            for table, columns in tables_cols.items():
                f.write(f"\n--- Analysis of {table} float/int columns: {columns} ---\n")
                for col in columns:
                    try:
                        count_null = conn.execute(text(f"SELECT COUNT(*) FROM {table} WHERE {col} IS NULL")).scalar()
                        # Use a query that specifically checks for empty strings regardless of type
                        # In MySQL, we can cast to char to check if it's literally ''
                        count_empty = conn.execute(text(f"SELECT COUNT(*) FROM {table} WHERE CAST({col} AS CHAR) = ''")).scalar()
                        f.write(f"Table '{table}', Column '{col}': {count_null} NULLs, {count_empty} detected as ''\n")
                    except Exception as e:
                        f.write(f"Error checking {table}.{col}: {e}\n")

if __name__ == "__main__":
    diagnose()
