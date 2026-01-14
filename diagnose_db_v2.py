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
            f.write(f"\n--- Checking for empty strings in columns: {columns} ---\n")
            
            for col in columns:
                try:
                    # Count rows where column is an empty string
                    count_res = conn.execute(text(f"SELECT COUNT(*) FROM users WHERE {col} = ''"))
                    count = count_res.scalar()
                    f.write(f"Column '{col}': {count} rows with empty string ('')\n")
                    
                    if count > 0:
                        f.write(f"  Sample IDs: ")
                        sample_res = conn.execute(text(f"SELECT id FROM users WHERE {col} = '' LIMIT 10"))
                        f.write(str([r[0] for r in sample_res]) + "\n")
                except Exception as e:
                    f.write(f"Error checking column '{col}': {e}\n")

if __name__ == "__main__":
    diagnose()
