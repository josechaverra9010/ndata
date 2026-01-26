import requests

url = "http://localhost:8000/api/recipes"
try:
    response = requests.get(url)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Number of recipes: {len(data)}")
        if len(data) > 0:
            print("First recipe structure:")
            print(data[0])
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
