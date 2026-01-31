import requests
import json

API_URL = "http://localhost:8000/api"

def test_patients_api():
    print(f"Testing API at: {API_URL}/patients")
    try:
        # Test without token
        response = requests.get(f"{API_URL}/patients")
        print(f"Response without token: {response.status_code}")
        print(f"Content: {response.text[:200]}")
        
        # Test with a dummy token (should probably fail with 401 but let's see)
        headers = {"Authorization": "Bearer dummy_token"}
        response = requests.get(f"{API_URL}/patients", headers=headers)
        print(f"Response with dummy token: {response.status_code}")
        print(f"Content: {response.text[:200]}")
        
    except Exception as e:
        print(f"Error connecting to API: {e}")

if __name__ == "__main__":
    test_patients_api()
