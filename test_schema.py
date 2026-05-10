import requests
import json

AIRTABLE_TOKEN = "patdr1i4H3Y36NVvm.f2122f67529919a3c23b51416c1fa9da893586a6373440062ed9cc8671213708"
BASE_ID = "appJjrKtsUfZAA0a3"

url = f"https://api.airtable.com/v0/meta/bases/{BASE_ID}/tables"
headers = {
    "Authorization": f"Bearer {AIRTABLE_TOKEN}",
}

try:
    response = requests.get(url, headers=headers)
    print("Meta API Status Code:", response.status_code)
    try:
        tables = response.json().get('tables', [])
        for t in tables:
            print(f"- Table: '{t['name']}'")
            for f in t.get('fields', []):
                print(f"    - Field: '{f['name']}'")
    except:
        print(response.text)
except Exception as e:
    print(e)
