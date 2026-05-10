import requests
import json

AIRTABLE_TOKEN = "patdr1i4H3Y36NVvm.f2122f67529919a3c23b51416c1fa9da893586a6373440062ed9cc8671213708"
BASE_ID = "appJjrKtsUfZAA0a3"
TABLE_NAME = "Table 1"

url = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}"

headers = {
    "Authorization": f"Bearer {AIRTABLE_TOKEN}",
    "Content-Type": "application/json"
}

payload = {
    "fields": {
        "Name": "test@test.com"
    }
}

try:
    response = requests.post(url, headers=headers, json=payload)
    print("Status Code:", response.status_code)
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(e)
