import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import UserDB, PatientCreateSchema, update_patient, get_db
from fastapi import HTTPException
import os

# Mock DB Session
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root@localhost/ndata")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def test_update_logic():
    print("Testing update_patient logic directly...")
    
    # 1. Find a test patient
    patient = db.query(UserDB).filter(UserDB.role == "patient").first()
    if not patient:
        print("No patient found to test.")
        return

    print(f"Testing with Patient ID: {patient.id} ({patient.nombres})")
    print(f"Initial Altura: {patient.altura}")
    
    # 2. Prepare update data
    # Create schema similar to what frontend sends
    new_height = 175.0 if patient.altura != 175.0 else 180.0
    
    # We must provide ALL required fields as per schema (nombres, apellidos, email)
    # optional fields can be None
    update_data = PatientCreateSchema(
        nombres=patient.nombres,
        apellidos=patient.apellidos,
        email=patient.email,
        altura=new_height, # THE CRITICAL FIELD
        peso_actual=patient.peso_actual if patient.peso_actual else 70,
        nivel_actividad="Moderada",
        alergias=[],
        preferencias=[]
    )
    
    print(f"Attempting to update Altura to: {new_height}")
    
    try:
        # 3. Call the backend function logic directly
        # Note: update_patient returns a dict or Pydantic model response
        response = update_patient(patient.id, update_data, db)
        
        print("Update function executed successfully.")
        
        # 4. Verify the returned response has the new height (verifying the API fix)
        # response might be a dict or object depending on main.py modification
        returned_height = response.get("altura") if isinstance(response, dict) else getattr(response, "altura", None)
        print(f"Response Altura: {returned_height}")
        
        if returned_height != new_height:
             print("FAILURE: Response does not contain new height!")
        else:
             print("SUCCESS: Response contains new height.")
             
        # 5. Verify DB persistence
        db.refresh(patient)
        print(f"DB Object Altura after refresh: {patient.altura}")
        
        if patient.altura != new_height:
            print("FAILURE: DB object was not updated!")
        else:
            print("SUCCESS: DB object updated correctly.")
            
    except Exception as e:
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_update_logic()
