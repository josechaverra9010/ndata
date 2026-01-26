import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

# Attempt to find the running backend URL
API_URL = os.getenv("VITE_API_URL", "http://localhost:8000") # Adjust port if needed
if API_URL.endswith("/api"):
    API_URL = API_URL[:-4]

print(f"Targeting API: {API_URL}")

# 1. Create a test patient or find one
# We need an admin token usually, but maybe we can bypass auth for this test 
# if we assume we are running locally and have DB access, 
# OR we can just try to hit the endpoints if they are unprotected or we can login.

# Let's try to login as superadmin first to get a token.
# Assuming standard credentials from previous context or default.
login_data = {
    "username": "admin@example.com", # Replace with valid admin
    "password": "password123"
}

# If we can't login, we might need to inspect DB directly.
# But let's verify via API if possible.

# Instead of full external API test which depends on running server state,
# let's try to unit test the DB update logic using direct SQLalchemy if possible 
# within the script, similar to inspect_users_table.py.
# This avoids "port not matching" or "server not running" issues.

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from main import UserDB, ProfileUpdateSchema, PatientCreateSchema

# We need to import the actual models to ensure SQLAlchemy knows about them
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "mysql+pymysql://root@localhost/ndata"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    print("Connecting to DB...")
    
    # 1. Create/Update a test user directly in DB to verify columns work
    test_email = "test_height@example.com"
    user = db.query(UserDB).filter(UserDB.email == test_email).first()
    
    if not user:
        print("Creating test user...")
        user = UserDB(
            nombres="Test",
            apellidos="Height",
            email=test_email,
            password="hashed_password",
            role="patient",
            status="activo"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    print(f"User ID: {user.id}")
    print(f"Current Altura: {user.altura}")
    
    # 2. Update Altura
    new_height = 185.5
    print(f"Updating Altura to {new_height}...")
    user.altura = new_height
    db.commit()
    db.refresh(user)
    
    # 3. Verify
    print(f"New Altura in DB Object: {user.altura}")
    
    # 4. Verify via raw SQL to ensure it's in the table
    result = db.execute(text(f"SELECT altura FROM users WHERE id = {user.id}"))
    raw_altura = result.scalar()
    print(f"Raw SQL Altura: {raw_altura}")
    
    if abs(raw_altura - new_height) < 0.01:
        print("SUCCESS: Height saved correctly in DB.")
    else:
        print("FAILURE: Height mismatch.")

except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
