import sqlite3
import os

DB_PATH = "sql_app.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found")
        return
        
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get existing columns
        cursor.execute("PRAGMA table_info(users)")
        existing_cols = {col[1] for col in cursor.fetchall()}
        
        # Columns to add and their types
        columns_to_add = [
            ("telefono", "TEXT"),
            ("genero", "TEXT"),
            ("direccion", "TEXT"),
            ("tipo_documento", "TEXT"),
            ("numero_documento", "TEXT"),
            ("foto_perfil", "TEXT"),
            ("altura", "REAL"),
            ("peso_inicial", "REAL"),
            ("peso_actual", "REAL"),
            ("peso_objetivo", "REAL"),
            ("nivel_actividad", "TEXT"),
            ("pal_factor", "REAL"),
            ("alergias", "JSON"),
            ("preferencias", "JSON"),
            ("objetivos_salud", "TEXT"),
            ("condiciones_medicas", "TEXT"),
            ("alimentos_disgusto", "TEXT"),
            ("antecedentes_familiares", "TEXT"),
            ("evaluacion_nutricional", "TEXT"),
            ("frecuencia_consumo", "JSON"),
            ("nutritionist_id", "INTEGER")
        ]
        
        for col_name, col_type in columns_to_add:
            if col_name not in existing_cols:
                print(f"Adding column {col_name}...")
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
        
        conn.commit()
        print("Migration completed successfully.")
        conn.close()
    except Exception as e:
        print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
