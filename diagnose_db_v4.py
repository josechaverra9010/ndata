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
    with open("diag_output_v4.txt", "w") as f:
        with engine.connect() as conn:
            # Check users
            f.write(f"--- Schema for table 'users' ---\n")
            res = conn.execute(text("DESCRIBE users"))
            for row in res:
                f.write(str(row) + "\n")
            
            # Check progress_metrics
            f.write(f"\n--- Schema for table 'progress_metrics' ---\n")
            res = conn.execute(text("DESCRIBE progress_metrics"))
            for row in res:
                f.write(str(row) + "\n")
                
            tables_cols = {
                'users': ['altura', 'peso_actual', 'peso_objetivo', 'peso_inicial'],
                'progress_metrics': ['weight', 'body_fat', 'muscle', 'water', 'waist', 'hip', 'chest', 'arm']
            }
            
            for table, columns in tables_cols.items():
                f.write(f"\n--- Analysis of {table} float columns: {columns} ---\n")
                for col in columns:
                    try:
                        count_null = conn.execute(text(f"SELECT COUNT(*) FROM {table} WHERE {col} IS NULL")).scalar()
                        count_empty = conn.execute(text(f"SELECT COUNT(*) FROM {table} WHERE {col} = ''")).scalar()
                        f.write(f"Table '{table}', Column '{col}': {count_null} NULLs, {count_empty} detected as ''\n")
                    except Exception as e:
                        f.write(f"Error checking {table}.{col}: {e}\n")

if __name__ == "__main__":
    diagnose()
