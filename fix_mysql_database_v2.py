import pymysql

def migrate():
    try:
        connection = pymysql.connect(
            host='localhost',
            user='root',
            password='',
            database='ndata',
            cursorclass=pymysql.cursors.DictCursor
        )
        
        with connection.cursor() as cursor:
            # Get existing columns
            cursor.execute("DESCRIBE users")
            existing_cols = {row['Field'] for row in cursor.fetchall()}
            
            # Columns to add and their types (MySQL syntax)
            columns_to_add = [
                ("telefono", "VARCHAR(20)"),
                ("genero", "VARCHAR(20)"),
                ("direccion", "TEXT"),
                ("tipo_documento", "VARCHAR(20)"),
                ("numero_documento", "VARCHAR(50)"),
                ("foto_perfil", "VARCHAR(255)"),
                ("altura", "FLOAT"),
                ("peso_inicial", "FLOAT"),
                ("peso_actual", "FLOAT"),
                ("peso_objetivo", "FLOAT"),
                ("nivel_actividad", "VARCHAR(50)"),
                ("pal_factor", "FLOAT"),
                ("alergias", "JSON"),
                ("preferencias", "JSON"),
                ("objetivos_salud", "TEXT"),
                ("condiciones_medicas", "TEXT"),
                ("alimentos_disgusto", "TEXT"),
                ("antecedentes_familiares", "TEXT"),
                ("evaluacion_nutricional", "TEXT"),
                ("frecuencia_consumo", "JSON"),
                ("nutritionist_id", "INT")
            ]
            
            for col_name, col_type in columns_to_add:
                if col_name not in existing_cols:
                    print(f"Adding column {col_name} to MySQL...")
                    try:
                        cursor.execute(f"ALTER TABLE users ADD COLUMN `{col_name}` {col_type}")
                        connection.commit()
                    except Exception as e:
                        print(f"Error adding {col_name}: {e}")
                else:
                    print(f"Column {col_name} already exists.")
                    
            # Check for patient 13
            cursor.execute("SELECT id FROM users WHERE id=13")
            if cursor.fetchone():
                print("Patient 13 found.")
            else:
                print("Patient 13 NOT found.")
                
            # List all patients for clarity
            cursor.execute("SELECT id, nombres, apellidos FROM users WHERE role='patient'")
            patients = cursor.fetchall()
            print("Patients in DB:")
            for p in patients:
                print(f"- ID {p['id']}: {p['nombres']} {p['apellidos']}")
                
    except Exception as e:
        print(f"Error connecting to MySQL: {e}")
    finally:
        if 'connection' in locals():
            connection.close()

if __name__ == "__main__":
    migrate()
