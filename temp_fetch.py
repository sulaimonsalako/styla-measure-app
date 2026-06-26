import os
import re
import random
import requests
from dotenv import load_dotenv
import base64
from playwright.sync_api import sync_playwright

load_dotenv()
AIRTABLE_PAT = os.getenv('AIRTABLE_PAT')
BASE_ID = 'app42bPMORZ7p5JND'
TABLE_NAME = 'Table 2'
URL = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}"

HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_PAT}",
}

def fetch_airtable_records():
    records = []
    offset = None
    while True:
        params = {}
        if offset:
            params['offset'] = offset
        response = requests.get(URL, headers=HEADERS, params=params)
        data = response.json()
        if 'records' in data:
            records.extend(data['records'])
        
        offset = data.get('offset')
        if not offset:
            break
    
    # Sort records
    try:
        records.sort(key=lambda x: x['fields'].get('Day', ''))
    except:
        pass
    return records

def highlight_text(text):
    sentences = text.split('. ', 1)
    if len(sentences) > 1:
        return f'<span class="highlight">{sentences[0]}.</span> {sentences[1]}'
    else:
        words = text.split(' ')
        if len(words) > 5:
            return f'<span class="highlight">{" ".join(words[:5])}</span> {" ".join(words[5:])}'
        return f'<span class="highlight">{text}</span>'

def get_base64_image(filepath):
    with open(filepath, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    return f"data:image/png;base64,{encoded_string}"


records = fetch_airtable_records()
import json
print(json.dumps(records, indent=2))

