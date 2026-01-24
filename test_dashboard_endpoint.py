import requests
import sys

BASE_URL = "http://localhost:8000/api"

def test_endpoint(patient_id):
    url = f"{BASE_URL}/patient/{patient_id}/dashboard/complete"
    print(f"Testing {url}...")
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Success!")
            # print(response.json())
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    for i in range(1, 10):
        test_endpoint(i)
