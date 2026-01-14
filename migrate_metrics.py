from sqlalchemy import create_engine, text

import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Si no hay DATABASE_URL en el entorno, usar una por defecto para desarrollo local
if not DATABASE_URL:
    DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ndata"

# Render a veces proporciona URLs que empiezan con 'postgres://', pero SQLAlchemy requiere 'postgresql://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def migrate():
    columns_to_add = [
        ("waist", "FLOAT"),
        ("hip", "FLOAT"),
        ("chest", "FLOAT"),
        ("arm", "FLOAT")
    ]
    
    with engine.connect() as conn:
        # Añadir columnas a progress_metrics
        for col_name, col_type in columns_to_add:
            try:
                conn.execute(text(f"ALTER TABLE progress_metrics ADD COLUMN {col_name} {col_type}"))
                print(f"Columna {col_name} añadida exitosamente a progress_metrics.")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    print(f"La columna {col_name} ya existe en progress_metrics.")
                else:
                    print(f"Error al añadir {col_name}: {e}")
        
        conn.commit()

if __name__ == "__main__":
    migrate()
