import requests
import json

AIRTABLE_TOKEN = "patdr1i4H3Y36NVvm.f2122f67529919a3c23b51416c1fa9da893586a6373440062ed9cc8671213708"
BASE_ID = "appJjrKtsUfZAA0a3"
TABLE_ID = "tblIZcUD55DIS7EEX"

url = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"

headers = {
    "Authorization": f"Bearer {AIRTABLE_TOKEN}",
    "Content-Type": "application/json"
}

payload = {
    "fields": {
        "Email": "test@test.com",
        "Sign Up Date": "2026-04-15",
        "Source": "Test API"
    }
}

try:
    response = requests.post(url, headers=headers, json=payload)
    print("Status Code:", response.status_code)
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(e)
