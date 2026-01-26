from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "mysql+pymysql://root@localhost/ndata"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def migrate():
    columns_to_add = [
        ("fase_1", "JSON"),
        ("fase_2", "JSON"),
        ("fase_3", "JSON"),
        ("fase_4", "JSON")
    ]
    
    with engine.connect() as conn:
        # Detectar el tipo de base de datos
        dialect = engine.dialect.name
        
        for col_name, col_type in columns_to_add:
            try:
                if dialect == 'postgresql':
                    # PostgreSQL usa JSON o JSONB
                    conn.execute(text(f"ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                elif dialect == 'mysql':
                    # MySQL usa JSON
                    # Primero verificar si la columna existe
                    check_query = text(f"""
                        SELECT COUNT(*) 
                        FROM information_schema.COLUMNS 
                        WHERE TABLE_SCHEMA = DATABASE() 
                        AND TABLE_NAME = 'meal_plans' 
                        AND COLUMN_NAME = '{col_name}'
                    """)
                    result = conn.execute(check_query).fetchone()
                    
                    if result and result[0] == 0:
                        conn.execute(text(f"ALTER TABLE meal_plans ADD COLUMN {col_name} {col_type}"))
                        print(f"Columna {col_name} añadida exitosamente a meal_plans.")
                    else:
                        print(f"La columna {col_name} ya existe en meal_plans.")
                else:
                    # SQLite u otros
                    conn.execute(text(f"ALTER TABLE meal_plans ADD COLUMN {col_name} TEXT"))
                    print(f"Columna {col_name} añadida exitosamente a meal_plans.")
            except Exception as e:
                err_msg = str(e).lower()
                if "duplicate column name" in err_msg or "already exists" in err_msg or "column" in err_msg and "already exists" in err_msg:
                    print(f"La columna {col_name} ya existe en meal_plans.")
                else:
                    print(f"Error al añadir {col_name}: {e}")
        
        conn.commit()
        print("\nMigración completada exitosamente.")

if __name__ == "__main__":
    migrate()
