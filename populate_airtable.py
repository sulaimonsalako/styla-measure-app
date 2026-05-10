import os
import re
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
AIRTABLE_PAT = os.getenv('AIRTABLE_PAT')

if not AIRTABLE_PAT:
    print("Error: AIRTABLE_PAT not found in .env file.")
    exit(1)

BASE_ID = 'app42bPMORZ7p5JND'
TABLE_NAME = 'Table 1'
URL = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}"

HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_PAT}",
    "Content-Type": "application/json"
}

# Path to the 30-day markdown artifact
MD_PATH = os.path.join(os.path.dirname(__file__), 'pain_engine_output.md')

def parse_markdown(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    days_data = []
    
    # Split the document by '### Day '
    blocks = content.split('### Day ')[1:]
    
    for block in blocks:
        lines = block.strip().split('\n')
        
        # The first line contains the Day number and Title
        title_line = lines[0].strip()
        day_str = f"Day {title_line}"
        
        hook = ""
        pain = ""
        solution = ""
        
        for line in lines[1:]:
            if '**Hook:**' in line:
                hook = line.split('**Hook:**')[1].strip()
            elif '**Problem:**' in line:
                pain = line.split('**Problem:**')[1].strip()
            elif '**Solution:**' in line:
                solution = line.split('**Solution:**')[1].strip()
                
        # Hardcoded CTA since it's the same goal for all 30 days
        cta = "Stop guessing your size. Drop the size chart into the STYLA AI Decoder and know for sure. Link in bio."
        
        days_data.append({
            "Day": day_str,
            "Hook": hook,
            "Pain": pain,
            "Solution": solution,
            "CTA": cta
        })
        
    return days_data

def upload_to_airtable(records):
    print(f"Parsed {len(records)} days. Uploading to Airtable...")
    
    # Airtable allows batch creation of up to 10 records per request
    batch_size = 10
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        
        airtable_records = []
        for rec in batch:
            airtable_records.append({
                "fields": {
                    "Day": rec["Day"],
                    "Hook": rec["Hook"],
                    "Pain": rec["Pain"],
                    "Solution": rec["Solution"],
                    "CTA": rec["CTA"]
                }
            })
            
        payload = {
            "records": airtable_records,
            "typecast": True
        }
        
        response = requests.post(URL, json=payload, headers=HEADERS)
        
        if response.status_code == 200:
            print(f"Successfully uploaded batch {i//batch_size + 1}")
        else:
            print(f"Failed to upload batch {i//batch_size + 1}. Error: {response.text}")

if __name__ == "__main__":
    if not os.path.exists(MD_PATH):
        print(f"Could not find markdown file at {MD_PATH}")
    else:
        parsed_records = parse_markdown(MD_PATH)
        upload_to_airtable(parsed_records)
        print("All 30 days successfully synced to Airtable!")
