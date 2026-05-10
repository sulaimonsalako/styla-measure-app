import requests
import json

AIRTABLE_TOKEN = "patdr1i4H3Y36NVvm.f2122f67529919a3c23b51416c1fa9da893586a6373440062ed9cc8671213708"

url = "https://api.airtable.com/v0/meta/bases"
headers = {"Authorization": f"Bearer {AIRTABLE_TOKEN}"}

response = requests.get(url, headers=headers)
print("Status Code:", response.status_code)
if response.status_code == 200:
    data = response.json()
    print("Bases the token has access to:")
    for base in data.get("bases", []):
        print(f"- {base['id']} : {base['name']}")
else:
    print(response.text)
