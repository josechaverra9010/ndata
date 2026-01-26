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

alter_statements = [
    "ALTER TABLE users ADD COLUMN altura FLOAT",
    "ALTER TABLE users ADD COLUMN peso_inicial FLOAT",
    "ALTER TABLE users ADD COLUMN peso_actual FLOAT",
    "ALTER TABLE users ADD COLUMN peso_objetivo FLOAT",
    "ALTER TABLE users ADD COLUMN nivel_actividad VARCHAR(50)",
    "ALTER TABLE users ADD COLUMN alergias JSON",
    "ALTER TABLE users ADD COLUMN preferencias JSON",
    "ALTER TABLE users ADD COLUMN objetivos_salud TEXT",
    "ALTER TABLE users ADD COLUMN condiciones_medicas TEXT",
    "ALTER TABLE users ADD COLUMN alimentos_disgusto TEXT",
    "ALTER TABLE users ADD COLUMN antecedentes_familiares TEXT"
]

with engine.connect() as conn:
    for stmt in alter_statements:
        try:
            print(f"Executing: {stmt}")
            conn.execute(text(stmt))
            print("  [SUCCESS]")
        except Exception as e:
            print(f"  [ERROR] {e}") # Likely already exists or syntax error
            
    conn.commit()
    print("\nMigration finished.")
