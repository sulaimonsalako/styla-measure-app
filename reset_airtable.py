import os
import requests
from dotenv import load_dotenv

load_dotenv()
AIRTABLE_PAT = os.getenv('AIRTABLE_PAT')
BASE_ID = 'app42bPMORZ7p5JND'
TABLE_NAME = 'Table 1'
URL = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}"

HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_PAT}"
}

def delete_all_records():
    print("Fetching records to delete...")
    records_to_delete = []
    offset = None
    
    while True:
        params = {}
        if offset:
            params['offset'] = offset
            
        res = requests.get(URL, headers=HEADERS, params=params)
        data = res.json()
        
        if 'records' in data:
            records_to_delete.extend([r['id'] for r in data['records']])
            
        offset = data.get('offset')
        if not offset:
            break
            
    print(f"Found {len(records_to_delete)} records to delete.")
    
    # Delete in batches of 10
    batch_size = 10
    for i in range(0, len(records_to_delete), batch_size):
        batch = records_to_delete[i:i+batch_size]
        params = [('records[]', record_id) for record_id in batch]
        
        res = requests.delete(URL, headers=HEADERS, params=params)
        if res.status_code == 200:
            print(f"Deleted batch {i//batch_size + 1}")
        else:
            print(f"Failed to delete batch: {res.text}")

if __name__ == "__main__":
    if AIRTABLE_PAT:
        delete_all_records()
        print("Airtable reset complete.")
    else:
        print("Missing AIRTABLE_PAT")
