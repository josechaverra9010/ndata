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

def fix():
    with engine.connect() as conn:
        print("Fixing database schema...")
        
        # 1. First, convert empty strings to NULL to avoid conversion errors during ALTER
        try:
            conn.execute(text("UPDATE users SET peso_inicial = NULL WHERE peso_inicial = ''"))
            print("Converted empty strings in peso_inicial to NULL.")
        except Exception as e:
            print(f"Error converting empty strings: {e}")
            
        # 2. Change column type to FLOAT and make it NULLABLE
        try:
            # MySQL syntax
            conn.execute(text("ALTER TABLE users MODIFY peso_inicial FLOAT NULL"))
            print("Changed peso_inicial column type to FLOAT and made it NULLABLE.")
        except Exception as e:
            print(f"Error altering column: {e}")
            
        # 3. Double check other float columns just in case
        for col in ['altura', 'peso_actual', 'peso_objetivo']:
            try:
                # Some might have '0' or just be weirdly stored
                conn.execute(text(f"UPDATE users SET {col} = NULL WHERE {col} = ''"))
            except:
                pass
                
        conn.commit()
        print("Fix completed.")

if __name__ == "__main__":
    fix()
