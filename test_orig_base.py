import requests

AIRTABLE_TOKEN = "patdr1i4H3Y36NVvm.f2122f67529919a3c23b51416c1fa9da893586a6373440062ed9cc8671213708"
BASE_ID = "appClhu7MydjEFeap" # Original Styla marketing base

url = f"https://api.airtable.com/v0/meta/bases/{BASE_ID}/tables"
headers = {"Authorization": f"Bearer {AIRTABLE_TOKEN}"}

response = requests.get(url, headers=headers)
print("Status against ORIGINAL Styla base:", response.status_code)
if response.status_code != 200:
    print(response.text)
