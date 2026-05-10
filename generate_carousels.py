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

def generate_carousels():
    records = fetch_airtable_records()
    if not records:
        print("No records found in Airtable.")
        return

    base_dir = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'carousels')
    bg_dir = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'backgrounds')
    template_path = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'template.html')
    
    os.makedirs(base_dir, exist_ok=True)
    
    with open(template_path, 'r', encoding='utf-8') as f:
        template_html = f.read()
        
    logo_path = os.path.join(os.path.dirname(__file__), 'logo.png')
    logo_b64 = ""
    try:
        logo_b64 = get_base64_image(logo_path)
    except Exception as e:
        print(f"Warning: Could not load logo.png: {e}")
        
    models = ['female_model_1.png', 'female_model_2.png', 'male_model_1.png', 'male_model_2.png']
    pain_bgs = ['pain_boxes.png', 'pain_closet.png', 'pain_measuring.png']
    
    print(f"Booting up Playwright Graphics Engine for {len(records)} posts...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1080, 'height': 1350}, device_scale_factor=2)
        
        for idx, rec in enumerate(records):
            fields = rec.get('fields', {})
            day_str = fields.get('Day', f'Idea_{idx+1}')
            day_str = re.sub(r'[<>:"/\\|?*]', '', day_str).replace(' ', '_').replace("'", "")
            
            hook = fields.get('Hook', '')
            pain = fields.get('Pain', '')
            solution = fields.get('Solution', '')
            cta = fields.get('CTA', '')
            
            day_dir = os.path.join(base_dir, day_str)
            os.makedirs(day_dir, exist_ok=True)
            
            selected_model = models[idx % len(models)]
            selected_pain_bg = pain_bgs[idx % len(pain_bgs)]
            
            def render_slide(text, tag, layout, bg_file, filename, index, total=4):
                if not text: return
                
                display_text = text
                if layout == 'layout-hook':
                    display_text = highlight_text(text)
                
                html = template_html.replace('{{SLIDE_CONTENT}}', display_text)
                html = html.replace('{{SLIDE_TAG}}', tag)
                html = html.replace('{{LAYOUT_CLASS}}', layout)
                html = html.replace('{{SLIDE_INDEX}}', str(index))
                html = html.replace('{{TOTAL_SLIDES}}', str(total))
                
                if logo_b64:
                    logo_html = f'<img src="{logo_b64}" class="h-10 object-contain drop-shadow-[0_0_10px_rgba(255,42,117,0.5)]">'
                    logo_html_small = f'<img src="{logo_b64}" class="w-full h-full object-contain">'
                    html = html.replace('{{LOGO_HTML}}', logo_html)
                    html = html.replace('{{LOGO_HTML_SMALL}}', logo_html_small)
                else:
                    html = html.replace('{{LOGO_HTML}}', '<div class="text-white font-black tracking-widest text-3xl uppercase">STYLA<span class="text-styla-pink drop-shadow-[0_0_10px_rgba(255,42,117,0.8)]">.</span></div>')
                    html = html.replace('{{LOGO_HTML_SMALL}}', '<span class="text-black font-black text-2xl">S</span>')
                
                # Text sizing based on layout
                if layout == 'layout-hook':
                    html = html.replace('{{TEXT_CLASS}}', 'text-5xl')
                    html = html.replace('{{GLASS_EXTRA_CLASS}}', '')
                elif layout == 'layout-overlay':
                    html = html.replace('{{TEXT_CLASS}}', 'text-4xl')
                    # Force glass panel to bottom for overlay
                    html = html.replace('{{GLASS_EXTRA_CLASS}}', 'mt-auto mb-10')
                else:
                    html = html.replace('{{TEXT_CLASS}}', 'text-[42px]')
                    html = html.replace('{{GLASS_EXTRA_CLASS}}', '')
                
                if bg_file:
                    bg_path = os.path.join(bg_dir, bg_file)
                    try:
                        b64_src = get_base64_image(bg_path)
                        bg_img = f'<img id="dynamic-bg" src="{b64_src}">'
                        html = html.replace('{{BG_HTML}}', bg_img)
                    except Exception as e:
                        print(f"Error loading bg {bg_file}: {e}")
                        html = html.replace('{{BG_HTML}}', '')
                else:
                    html = html.replace('{{BG_HTML}}', '')
                
                # CTA & Swipe
                if index == total:
                    html = html.replace('{{SWIPE_BLOCK}}', '')
                    html = html.replace('{{CTA_BLOCK}}', '<div class="mt-16 flex items-center gap-6"><div class="px-12 py-6 bg-[#ff2a75] text-white font-black text-2xl rounded-full tracking-wide shadow-[0_0_20px_rgba(255,42,117,0.5)]">Decode Your Size</div><div class="text-white/80 text-xl font-bold bg-black/40 px-6 py-3 rounded-full">styla.ca</div></div>')
                else:
                    html = html.replace('{{SWIPE_BLOCK}}', '<div class="text-[#ff2a75] text-2xl font-bold flex items-center gap-2 animate-pulse bg-black/40 px-6 py-3 rounded-full backdrop-blur-md">Swipe <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg></div>')
                    html = html.replace('{{CTA_BLOCK}}', '')
                
                page.set_content(html)
                page.evaluate("document.fonts.ready")
                page.wait_for_timeout(200) # Give local images time to load
                page.screenshot(path=os.path.join(day_dir, filename))

            # Slide 1: Hook (Text format, no bg)
            render_slide(hook, "THE TRAP", 'layout-hook', None, 'slide_1_hook.png', 1)
            
            # Slide 2: Pain (Pain format, dark background)
            render_slide(pain, "THE REALITY", 'layout-pain', selected_pain_bg, 'slide_2_pain.png', 2)
            
            # Slide 3: Solution (Overlay format, model background)
            render_slide(solution, "THE STYLA FIX", 'layout-overlay', selected_model, 'slide_3_solution.png', 3)
            
            # Slide 4: CTA (Text format, no bg)
            render_slide(cta, "THE NEXT STEP", 'layout-hook', None, 'slide_4_cta.png', 4)
            
            print(f"Generated dynamic graphics for {day_str}")
            
        browser.close()
        
    print(f"\nSuccess! All high-conversion STYLA multi-format slides saved to {base_dir}")

if __name__ == "__main__":
    generate_carousels()
