import os
import requests
import json

AIRTABLE_TOKEN = "patdr1i4H3Y36NVvm.f2122f67529919a3c23b51416c1fa9da893586a6373440062ed9cc8671213708"
BASE_ID = "appJjrKtsUfZAA0a3"

headers = {
    "Authorization": f"Bearer {AIRTABLE_TOKEN}",
    "Content-Type": "application/json"
}

payload = {
    "name": "Waitlist",
    "description": "Waitlist signups for STYLA Measure",
    "fields": [
        {
            "name": "Email",
            "type": "email"
        },
        {
            "name": "Sign Up Date",
            "type": "date",
            "options": {
                "dateFormat": {
                    "name": "iso",
                    "format": "YYYY-MM-DD"
                }
            }
        },
        {
            "name": "Source",
            "type": "singleLineText"
        }
    ]
}

url = f"https://api.airtable.com/v0/meta/bases/{BASE_ID}/tables"
print(f"Creating Waitlist table in Base {BASE_ID}...")
response = requests.post(url, headers=headers, json=payload)

if response.status_code == 200:
    print("✅ Successfully created Waitlist table!")
else:
    print(f"❌ Failed to create table: {response.status_code}")
    print(response.text)
