# -*- coding: utf-8 -*-
import os
import base64
import re
from playwright.sync_api import sync_playwright

def get_base64_image(filepath):
    with open(filepath, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    return f"data:image/png;base64,{encoded_string}"

def get_screenshot_html(filename, header_text):
    filepath = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'screenshots', filename)
    b64_img = get_base64_image(filepath) if os.path.exists(filepath) else ""
    return f'''
    <div style="display:flex; flex-direction:column; align-items:center; height:100%; justify-content:center; width:100%;">
        <h2 style="color:#fff; font-size:42px; font-weight:900; margin-bottom:60px; text-align:center; font-family:sans-serif; text-transform:uppercase; letter-spacing:2px;">
            <span style="color:#ff2a75; margin-right:15px;">&#9632;</span>{header_text}
        </h2>
        <div style="width:100%; max-width:960px; background:rgba(0,0,0,0.5); padding:10px; border-radius:24px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 30px 60px rgba(0,0,0,0.8);">
            <img src="{b64_img}" style="width:100%; height:auto; object-fit:contain; border-radius:16px;">
        </div>
    </div>
    '''

def run_generation():
    base_dir = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'unified_carousel')
    template_path = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'template.html')
    
    os.makedirs(base_dir, exist_ok=True)
    
    with open(template_path, 'r', encoding='utf-8') as f:
        template_html = f.read()

    logo_path = os.path.join(os.path.dirname(__file__), 'logo.png')
    logo_b64 = get_base64_image(logo_path) if os.path.exists(logo_path) else ""

    covers = [
        {"title": "Are you pricing your products too low?", "bg": "male_model_1.png", "filename": "1_pricing_cover"},
        {"title": "Don't order another unit without calculating this.", "bg": "female_model_2.png", "filename": "2_moq_cover"},
        {"title": "The profit margin formula you need to know.", "bg": "male_model_2.png", "filename": "3_margin_cover"}
    ]

    body_slides = [
        {
            "filename": "page_2",
            "bg": "pain_boxes.png",
            "content": get_screenshot_html("Calculate price flat order.png", "Input Costs & Get Instant Pricing Models")
        },
        {
            "filename": "page_3",
            "bg": "pain_closet.png",
            "content": get_screenshot_html("Calculate price target margin.png", "Set a Target Margin & Work Backwards")
        },
        {
            "filename": "page_4",
            "bg": "pain_measuring.png",
            "content": get_screenshot_html("Virtual cost vs profit analysis unit scale.png", "Visualize Break-Even Across MOQs")
        }
    ]

    swipe_html = '<div class="text-[#ff2a75] text-2xl font-bold flex items-center gap-2 animate-pulse bg-black/40 px-6 py-3 rounded-full backdrop-blur-md">Swipe <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg></div>'

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1080, 'height': 1350}, device_scale_factor=2)
        
        def render(content_html, layout, filename, bg_name, show_swipe=True, is_cta=False):
            bg_path = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'backgrounds', bg_name)
            b64_src = get_base64_image(bg_path) if os.path.exists(bg_path) else ""
            bg_html = f'<img id="dynamic-bg" src="{b64_src}">' if b64_src else ''
            
            html = template_html.replace('height: 1350px;', 'height: 1350px;')
            html = html.replace('{{LAYOUT_CLASS}}', layout)
            html = html.replace('{{BG_HTML}}', bg_html)
            html = html.replace('{{SLIDE_TAG_BLOCK}}', '')
            
            # Remove Page Numbers
            html = re.sub(r'<div class="z-10 w-full px-20 pt-20 flex justify-end items-center drop-shadow-md">.*?</div>\s*</div>', '', html, flags=re.DOTALL)
            
            # Logo
            logo_html_small = f'<img src="{logo_b64}" class="w-full h-full object-contain">' if logo_b64 else ''
            html = html.replace('{{LOGO_HTML_SMALL}}', logo_html_small)
            
            # Text/Content
            html = html.replace('{{SLIDE_CONTENT}}', content_html)
            
            if layout == 'layout-cinematic':
                html = html.replace('{{TEXT_CLASS}}', 'text-[3rem] font-serif leading-snug')
                html = html.replace('{{GLASS_EXTRA_CLASS}}', '')
                html = html.replace('{{ACCENT_CLASS}}', 'accent-border')
            elif layout == 'layout-overlay':
                html = html.replace('{{TEXT_CLASS}}', '')
                html = html.replace('{{ACCENT_CLASS}}', '')
                html = html.replace('{{GLASS_EXTRA_CLASS}}', 'mt-auto mb-20 w-full h-full')
            
            # Swipe / CTA
            if is_cta:
                html = html.replace('{{SWIPE_BLOCK}}', '')
                html = html.replace('{{CTA_BLOCK}}', '<div class="mt-16 flex justify-center"><div class="px-12 py-6 bg-[#ff2a75] text-white font-black text-2xl rounded-full tracking-wide shadow-[0_0_20px_rgba(255,42,117,0.5)]">styla.ca/tools/pricing-calculator.html</div></div>')
            else:
                html = html.replace('{{SWIPE_BLOCK}}', swipe_html if show_swipe else '')
                html = html.replace('{{CTA_BLOCK}}', '')

            page.set_content(html)
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(500)
            page.screenshot(path=os.path.join(base_dir, f"{filename}.png"))
            print(f"Generated {filename}.png")

        # 1. Generate the 3 covers with Swipe Arrow
        for cov in covers:
            render(cov["title"], 'layout-cinematic', cov["filename"], cov["bg"], show_swipe=True)

        # 2. Generate Body Slides (Pages 2-4)
        for slide in body_slides:
            render(slide["content"], 'layout-overlay', slide["filename"], slide["bg"], show_swipe=True)

        # 3. Generate CTA Slide (Page 5)
        cta_text = "Stop guessing.<br>Start strategizing.<br><br>Try the free calculator today."
        render(cta_text, 'layout-cinematic', "page_5_cta", "male_model_1.png", show_swipe=False, is_cta=True)

        browser.close()

if __name__ == "__main__":
    run_generation()
