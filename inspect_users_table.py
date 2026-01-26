from sqlalchemy import create_engine, inspect
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "mysql+pymysql://root@localhost/ndata"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

try:
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    if "users" in inspector.get_table_names():
        print(f"Table 'users' exists.")
        columns = inspector.get_columns("users")
        column_names = [col['name'] for col in columns]
        
        expected_columns = [
            "altura", "peso_inicial", "peso_actual", "peso_objetivo", 
            "nivel_actividad", "alergias", "preferencias", 
            "objetivos_salud", "condiciones_medicas", 
            "alimentos_disgusto", "antecedentes_familiares"
        ]
        
        print("\nChecking for expected columns:")
        missing_columns = []
        for col in expected_columns:
            if col in column_names:
                print(f"  [OK] {col}")
            else:
                print(f"  [MISSING] {col}")
                missing_columns.append(col)
                
        if missing_columns:
            print(f"\nFound {len(missing_columns)} missing columns.")
        else:
            print("\nAll columns present.")
    else:
        print("Table 'users' does not exist.")

except Exception as e:
    print(f"Error: {e}")
