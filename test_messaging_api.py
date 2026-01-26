import requests
import jwt
import os
from datetime import datetime, timedelta

# Mocking the token generation to test the endpoint locally
SECRET_KEY = os.getenv("SECRET_KEY", "TU_LLAVE_SECRETA_SUPER_SEGURA")
ALGORITHM = "HS256"

def create_test_token(user_id, email, role):
    payload = {
        "sub": email,
        "id": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# Assuming Admin ID is 1 (based on previous check)
token = create_test_token(1, "josechaverra9010@gmail.com", "admin")

url = "http://localhost:8000/api/messages/conversations"
headers = {"Authorization": f"Bearer {token}"}

try:
    response = requests.get(url, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
