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
    with open("diag_output.txt", "w") as f:
        with engine.connect() as conn:
            f.write(f"--- Schema for table 'users' ---\n")
            res = conn.execute(text("DESCRIBE users"))
            for row in res:
                f.write(str(row) + "\n")
                
            columns = ['altura', 'peso_actual', 'peso_objetivo', 'peso_inicial']
            f.write(f"\n--- Analysis of float columns: {columns} ---\n")
            
            for col in columns:
                try:
                    # Count NULLs
                    count_null = conn.execute(text(f"SELECT COUNT(*) FROM users WHERE {col} IS NULL")).scalar()
                    # Count empty strings (should be 0 for float, but let's check what SQL says)
                    count_empty = conn.execute(text(f"SELECT COUNT(*) FROM users WHERE {col} = ''")).scalar()
                    
                    f.write(f"Column '{col}': {count_null} NULLs, {count_empty} detected as ''\n")
                    
                    if count_empty > 0 or count_null > 0:
                        f.write(f"  Values for IDs [1, 9]: ")
                        samples = conn.execute(text(f"SELECT id, {col} FROM users WHERE id IN (1, 9)"))
                        f.write(str([(r[0], r[1]) for r in samples]) + "\n")
                except Exception as e:
                    f.write(f"Error checking column '{col}': {e}\n")

if __name__ == "__main__":
    diagnose()
