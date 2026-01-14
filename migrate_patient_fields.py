from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fallback paths based on main.py and codebase search
    DATABASE_URL = "mysql+pymysql://root@localhost/ndata"

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# If still no DATABASE_URL, check for SQLite sql_app.db
if not DATABASE_URL and os.path.exists("sql_app.db"):
    DATABASE_URL = "sqlite:///sql_app.db"

engine = create_engine(DATABASE_URL)

def migrate():
    with engine.connect() as conn:
        try:
            # Check if it's SQLite, MySQL or Postgres for correct syntax
            dialect = engine.dialect.name
            if dialect == 'postgresql':
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS antecedentes_familiares TEXT"))
            else:
                conn.execute(text("ALTER TABLE users ADD COLUMN antecedentes_familiares TEXT"))
            print("Columna antecedentes_familiares añadida exitosamente a users.")
        except Exception as e:
            err_msg = str(e).lower()
            if "duplicate column name" in err_msg or "already exists" in err_msg:
                print("La columna antecedentes_familiares ya existe en users.")
            else:
                print(f"Error al añadir antecedentes_familiares: {e}")
        
        conn.commit()

if __name__ == "__main__":
    migrate()
