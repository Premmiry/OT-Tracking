import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def login(username, password):
    url = f"{BASE_URL}/api/auth/login"
    data = {"username": username, "password": password}
    response = requests.post(url, json=data)
    if response.status_code == 200:
        return response.json()["token"]
    else:
        print(f"Login failed: {response.status_code} {response.text}")
        return None

def check_offsets(token):
    url = f"{BASE_URL}/api/offsets"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    print(f"Status Code: {response.status_code}")
    if response.status_code != 200:
        print(f"Response: {response.text}")
    else:
        print("Offsets fetched successfully")
        print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    token = login("pisit", "03012526")
    if token:
        check_offsets(token)
