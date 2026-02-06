"""
Test the /api/patient/{patient_id}/plan/weekly endpoint directly
"""
import requests
import json

# Configuration
API_URL = "http://localhost:8000/api"
PATIENT_ID = 1  # Adjust this to a valid patient ID

print("=" * 80)
print(f"Testing: {API_URL}/patient/{PATIENT_ID}/plan/weekly")
print("=" * 80)

try:
    response = requests.get(f"{API_URL}/patient/{PATIENT_ID}/plan/weekly")
    
    print(f"\nStatus Code: {response.status_code}")
    print(f"\nResponse:")
    print("-" * 80)
    
    if response.status_code == 200:
        data = response.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        # Check stats specifically
        if "stats" in data:
            print("\n" + "=" * 80)
            print("STATS BREAKDOWN:")
            print("=" * 80)
            stats = data["stats"]
            print(f"Calories Target: {stats.get('calories', {}).get('target', 'N/A')}")
            print(f"Protein Target: {stats.get('protein', {}).get('target', 'N/A')}g")
            print(f"Carbs Target: {stats.get('carbs', {}).get('target', 'N/A')}g")
            print(f"Fat Target: {stats.get('fat', {}).get('target', 'N/A')}g")
    else:
        print(response.text)
        
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 80)
