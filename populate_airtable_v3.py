import os
import requests
from dotenv import load_dotenv

load_dotenv()
AIRTABLE_PAT = os.getenv('AIRTABLE_PAT')
BASE_ID = 'app42bPMORZ7p5JND'
TABLE_NAME = 'Table 2'
URL = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}"

HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_PAT}",
    "Content-Type": "application/json"
}

MD_PATH = os.path.join(os.path.dirname(__file__), 'pain_engine_output_v3.md')

def parse_markdown(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    days_data = []
    blocks = content.split('### Day Custom_Idea_')[1:]
    
    for block in blocks:
        lines = block.strip().split('\n')
        
        title_line = lines[0].strip()
        day_str = f"Idea {title_line}"
        
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
    print(f"Parsed {len(records)} days. Uploading to Airtable Table 2...")
    
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
        print("All 12 user ideas successfully synced to Airtable Table 2!")
