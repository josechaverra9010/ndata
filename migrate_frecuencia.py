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

def migrate():
    try:
        with engine.connect() as connection:
            print("Checking if 'frecuencia_consumo' column exists...")
            if "postgresql" in DATABASE_URL:
                column_check_query = text("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='frecuencia_consumo';")
            else:
                column_check_query = text("SHOW COLUMNS FROM users LIKE 'frecuencia_consumo';")
            
            result = connection.execute(column_check_query).fetchone()
            
            if not result:
                print("Column missing. Adding 'frecuencia_consumo' JSON column to 'users' table...")
                # MySQL uses JSON, Postgres uses JSONB or JSON
                if "postgresql" in DATABASE_URL:
                    connection.execute(text("ALTER TABLE users ADD COLUMN frecuencia_consumo JSONB;"))
                else:
                    connection.execute(text("ALTER TABLE users ADD COLUMN frecuencia_consumo JSON;"))
                
                connection.commit()
                print("Migration successful: Added 'frecuencia_consumo' column.")
            else:
                print("Column 'frecuencia_consumo' already exists.")
                
    except Exception as e:
        print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
