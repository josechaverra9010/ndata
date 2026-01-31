import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import datetime

# Mocking the environment for main.py imports
import os
os.environ["DATABASE_URL"] = "sqlite:///sql_app.db"

# Import from main.py
try:
    from main import UserDB, PatientCreateSchema, get_db, SessionLocal
except ImportError as e:
    print(f"Failed to import from main.py: {e}")
    sys.exit(1)

def repro_update(patient_id):
    db = SessionLocal()
    try:
        print(f"Testing update for patient {patient_id}")
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        if not patient:
            print("Patient not found")
            return

        print(f"Found patient: {patient.nombres} {patient.apellidos}")
        
        # Simulate update logic from main.py:update_patient
        # Just a subset of updates to see if it even reaches here
        patient.nombres = patient.nombres # No change
        
        print("Committing...")
        db.commit()
        print("Refreshing...")
        db.refresh(patient)
        
        print("Calculating progress...")
        # Need to import helper functions if they are not in main.py's global scope or if they fail
        from main import calcular_progreso, calcular_edad_detallada
        
        progreso_calc = calcular_progreso(patient.peso_actual, patient.peso_objetivo, patient.peso_inicial)
        print(f"Progreso: {progreso_calc}")
        
        edad_form = calcular_edad_detallada(patient.fecha_nacimiento)
        print(f"Edad: {edad_form}")
        
        print("Building response map...")
        res = {
            "id": patient.id,
            "nombres": patient.nombres,
            "apellidos": patient.apellidos,
            "email": patient.email,
            "telefono": patient.telefono,
            "fecha_nacimiento": patient.fecha_nacimiento.strftime("%Y-%m-%d") if patient.fecha_nacimiento else None,
            "genero": patient.genero,
            "direccion": patient.direccion,
            "tipo_documento": patient.tipo_documento,
            "numero_documento": patient.numero_documento,
            "foto_perfil": patient.foto_perfil,
            "status": patient.status or "activo",
            "role": patient.role,
            "peso_actual": patient.peso_actual,
            "peso_objetivo": patient.peso_objetivo,
            "nivel_actividad": patient.nivel_actividad,
            "pal_factor": patient.pal_factor,
            "alergias": patient.alergias or [],
            "preferencias": patient.preferencias or [],
            "objetivos_salud": patient.objetivos_salud,
            "condiciones_medicas": patient.condiciones_medicas,
            "alimentos_disgusto": patient.alimentos_disgusto,
            "antecedentes_familiares": patient.antecedentes_familiares,
            "progreso": progreso_calc,
            "proxima_cita": "Sin programar",
            "altura": patient.altura,
            "edad_formateada": edad_form,
            "evaluacion_nutricional": patient.evaluacion_nutricional,
            "frecuencia_consumo": patient.frecuencia_consumo
        }
        print("Success!")
        
    except Exception as e:
        import traceback
        print("Caught exception:")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    repro_update(13)
