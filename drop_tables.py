from sqlalchemy import create_engine, MetaData, Table, text
import os
from dotenv import load_dotenv

load_dotenv()

# Configuración de Base de Datos
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ndata"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
metadata = MetaData()

def drop_problematic_tables():
    tables_to_drop = [
        "meal_tracking", 
        "water_tracking", 
        "meal_food_items", 
        "notifications",
        "messages"
    ]
    
    try:
        with engine.connect() as conn:
            # PostgreSQL no usa FOREIGN_KEY_CHECKS, usa cascada o desactiva triggers si es necesario
            # Pero para tablas específicas, podemos intentar borrarlas una por una o usar CASCADE
            
            print("Iniciando eliminación de tablas...")
            for table_name in tables_to_drop:
                try:
                    # Usamos SQL directo para asegurar el CASCADE en PostgreSQL
                    conn.execute(text(f"DROP TABLE IF EXISTS {table_name} CASCADE"))
                    print(f"Borrando tabla: {table_name}")
                except Exception as e:
                    print(f"Error al borrar {table_name}: {e}")
            
            conn.commit()
            print("Tablas borradas exitosamente.")
    except Exception as e:
        print(f"Error general: {e}")

if __name__ == "__main__":
    drop_problematic_tables()
