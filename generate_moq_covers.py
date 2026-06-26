import os
import base64
import re
from playwright.sync_api import sync_playwright

def get_base64_image(filepath):
    with open(filepath, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    return f"data:image/png;base64,{encoded_string}"

def generate_covers():
    base_dir = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'moq_covers')
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
        pass

    covers = [
        {"title": "Are you pricing your products too low?", "bg": "male_model_1.png", "filename": "1_pricing"},
        {"title": "Don't order another unit without calculating this.", "bg": "female_model_2.png", "filename": "2_moq"},
        {"title": "The profit margin formula you need to know.", "bg": "male_model_2.png", "filename": "3_margin"}
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # 1. LinkedIn format (1080x1350)
        page_li = browser.new_page(viewport={'width': 1080, 'height': 1350}, device_scale_factor=2)
        
        # 2. TikTok format (1080x1920)
        page_tk = browser.new_page(viewport={'width': 1080, 'height': 1920}, device_scale_factor=2)
        
        for platform in ['linkedin', 'tiktok']:
            page = page_li if platform == 'linkedin' else page_tk
            height = "1350px" if platform == 'linkedin' else "1920px"
            
            for cov in covers:
                html = template_html.replace('height: 1350px;', f'height: {height};')
                
                # Setup cinematic layout
                html = html.replace('{{LAYOUT_CLASS}}', 'layout-cinematic')
                html = html.replace('{{SLIDE_TAG_BLOCK}}', '')
                
                # Remove Header (Page Numbers)
                html = re.sub(r'<div class="z-10 w-full px-20 pt-20 flex justify-end items-center drop-shadow-md">.*?</div>\s*</div>', '', html, flags=re.DOTALL)
                
                if logo_b64:
                    logo_html_small = f'<img src="{logo_b64}" class="w-full h-full object-contain">'
                    html = html.replace('{{LOGO_HTML_SMALL}}', logo_html_small)
                else:
                    html = html.replace('{{LOGO_HTML_SMALL}}', '')
                
                html = html.replace('{{TEXT_CLASS}}', 'text-[4rem] font-serif')
                html = html.replace('{{GLASS_EXTRA_CLASS}}', '')
                html = html.replace('{{ACCENT_CLASS}}', 'accent-border')
                
                # Content
                html = html.replace('{{SLIDE_CONTENT}}', cov["title"])
                
                # Background
                bg_path = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'backgrounds', cov["bg"])
                if os.path.exists(bg_path):
                    b64_src = get_base64_image(bg_path)
                    html = html.replace('{{BG_HTML}}', f'<img id="dynamic-bg" src="{b64_src}">')
                else:
                    html = html.replace('{{BG_HTML}}', '')
                
                # Footer elements
                html = html.replace('{{SWIPE_BLOCK}}', '')
                html = html.replace('{{CTA_BLOCK}}', '')
                
                page.set_content(html)
                page.evaluate("document.fonts.ready")
                page.wait_for_timeout(500)
                
                out_path = os.path.join(base_dir, f'{platform}_{cov["filename"]}.png')
                page.screenshot(path=out_path)
                print(f"Generated: {out_path}")

        browser.close()

if __name__ == "__main__":
    generate_covers()
