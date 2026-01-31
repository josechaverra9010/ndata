import sys
import os
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import from main.py
try:
    from main import UserDB, SessionLocal, calcular_progreso, calcular_edad_detallada
except ImportError as e:
    print(f"Failed to import from main.py: {e}")
    sys.exit(1)

def test_mysql_update(patient_id):
    db = SessionLocal()
    try:
        print(f"Testing MySQL update for patient {patient_id}")
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        if not patient:
            print("Patient not found in MySQL")
            return

        print(f"Initial state: {patient.nombres} {patient.apellidos}, role: {patient.role}")
        
        # Simulate a small update
        original_nombres = patient.nombres
        patient.nombres = original_nombres + " (Tested)"
        
        print("Committing...")
        db.commit()
        print("Refreshing...")
        db.refresh(patient)
        
        print(f"Updated state: {patient.nombres}")
        
        # Verify calculated fields
        prog = calcular_progreso(patient.peso_actual, patient.peso_objetivo, patient.peso_inicial)
        print(f"Progreso: {prog}")
        
        edad = calcular_edad_detallada(patient.fecha_nacimiento)
        print(f"Edad: {edad}")
        
        # Restore original state
        patient.nombres = original_nombres
        db.commit()
        print("Restored original state.")
        
        print("SUCCESS: MySQL update logic is working!")
        
    except Exception as e:
        import traceback
        print("FAILURE: Caught exception during MySQL update:")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_mysql_update(13)
