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
            print("Checking if 'evaluacion_nutricional' column exists...")
            # Use appropriate syntax for MySQL or Postgres
            if "postgresql" in DATABASE_URL:
                column_check_query = text("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='evaluacion_nutricional';")
            else:
                column_check_query = text("SHOW COLUMNS FROM users LIKE 'evaluacion_nutricional';")
            
            result = connection.execute(column_check_query).fetchone()
            
            if not result:
                print("Column missing. Adding 'evaluacion_nutricional' and 'evaluacion_nutricional' to 'users' table...")
                connection.execute(text("ALTER TABLE users ADD COLUMN evaluacion_nutricional TEXT;"))
                connection.commit()
                print("Migration successful: Added 'evaluacion_nutricional' column.")
            else:
                print("Column 'evaluacion_nutricional' already exists.")
                
    except Exception as e:
        print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
