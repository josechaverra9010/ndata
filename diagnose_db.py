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
    with engine.connect() as conn:
        print(f"--- Schema for table 'users' ---")
        res = conn.execute(text("DESCRIBE users"))
        for row in res:
            print(row)
            
        columns = ['altura', 'peso_actual', 'peso_objetivo', 'peso_inicial']
        print(f"\n--- Checking for empty strings in columns: {columns} ---")
        
        for col in columns:
            try:
                # Count rows where column is an empty string
                count_res = conn.execute(text(f"SELECT COUNT(*) FROM users WHERE {col} = ''"))
                count = count_res.scalar()
                print(f"Column '{col}': {count} rows with empty string ('')")
                
                if count > 0:
                    print(f"  Sample IDs: ", end="")
                    sample_res = conn.execute(text(f"SELECT id FROM users WHERE {col} = '' LIMIT 5"))
                    print([r[0] for r in sample_res])
            except Exception as e:
                print(f"Error checking column '{col}': {e}")

if __name__ == "__main__":
    diagnose()
