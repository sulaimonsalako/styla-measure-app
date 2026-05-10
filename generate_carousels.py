import os
import re
import requests
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

# Load environment variables
load_dotenv()
AIRTABLE_PAT = os.getenv('AIRTABLE_PAT')
BASE_ID = 'app42bPMORZ7p5JND'
TABLE_NAME = 'Table 1'
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
            
    # Sort by Day if possible
    try:
        records.sort(key=lambda x: int(x['fields'].get('Day', '0').split()[1].replace(':', '')))
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

def generate_carousels():
    records = fetch_airtable_records()
    if not records:
        print("No records found in Airtable.")
        return

    base_dir = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'carousels')
    template_path = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'template.html')
    
    os.makedirs(base_dir, exist_ok=True)
    
    with open(template_path, 'r', encoding='utf-8') as f:
        template_html = f.read()
    
    print(f"Booting up Playwright Graphics Engine for {len(records)} days...")
    
    with sync_playwright() as p:
        # Launch Chromium headless
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1080, 'height': 1350}, device_scale_factor=2)
        
        for rec in records:
            fields = rec.get('fields', {})
            day_str = fields.get('Day', 'Unknown_Day')
            day_str = re.sub(r'[<>:"/\\|?*]', '', day_str)
            day_str = day_str.replace(' ', '_').replace("'", "")
            
            hook = fields.get('Hook', '')
            pain = fields.get('Pain', '')
            solution = fields.get('Solution', '')
            cta = fields.get('CTA', '')
            
            day_dir = os.path.join(base_dir, day_str)
            os.makedirs(day_dir, exist_ok=True)
            
            def render_slide(text, tag, is_hook, filename, index, total=4):
                if not text: return
                
                # Apply highlight to hook
                display_text = text
                if is_hook:
                    display_text = highlight_text(text)
                
                html = template_html.replace('{{SLIDE_CONTENT}}', display_text)
                html = html.replace('{{SLIDE_TAG}}', tag)
                html = html.replace('{{TEXT_CLASS}}', 'text-5xl' if is_hook else 'text-[42px] text-white/80')
                html = html.replace('{{SLIDE_INDEX}}', str(index))
                html = html.replace('{{TOTAL_SLIDES}}', str(total))
                
                if index == total:
                    html = html.replace('{{SWIPE_BLOCK}}', '')
                    html = html.replace('{{CTA_BLOCK}}', '<div class="mt-16 flex items-center gap-6"><div class="px-10 py-6 bg-[#ff2a75] text-white font-black text-2xl rounded-full tracking-wide">Decode Your Size</div><div class="text-[#9090b0] text-xl font-bold">styla-measure.vercel.app</div></div>')
                else:
                    html = html.replace('{{SWIPE_BLOCK}}', '<div class="text-[#ff2a75] text-2xl font-bold flex items-center gap-2 animate-pulse">Swipe <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg></div>')
                    html = html.replace('{{CTA_BLOCK}}', '')
                
                page.set_content(html)
                page.evaluate("document.fonts.ready")
                # Wait a bit for layout
                page.wait_for_timeout(100)
                page.screenshot(path=os.path.join(day_dir, filename))

            render_slide(hook, "THE TRAP", True, 'slide_1_hook.png', 1)
            render_slide(pain, "THE REALITY", False, 'slide_2_pain.png', 2)
            render_slide(solution, "THE FIX", False, 'slide_3_solution.png', 3)
            render_slide(cta, "THE NEXT STEP", False, 'slide_4_cta.png', 4)
            
            print(f"Generated graphics for {day_str}")
            
        browser.close()
        
    print(f"\nSuccess! All high-conversion STYLA slides saved to {base_dir}")

if __name__ == "__main__":
    generate_carousels()
