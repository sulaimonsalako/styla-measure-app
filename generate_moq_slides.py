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

def generate_slides():
    base_dir = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'moq_covers')
    template_path = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'template.html')
    
    with open(template_path, 'r', encoding='utf-8') as f:
        template_html = f.read()

    logo_path = os.path.join(os.path.dirname(__file__), 'logo.png')
    logo_b64 = get_base64_image(logo_path) if os.path.exists(logo_path) else ""

    themes = [
        {
            "prefix": "pricing",
            "bg": "pain_boxes.png",
            "slide2": "Most founders just multiply their cost by 2.5x.<br><br><span style='color:#ff2a75;'>But they forget to include freight, packaging, and hidden marketing overheads.</span>",
            "slide3_html": get_screenshot_html("Calculate price target margin.png", "Input Costs & Target Margin"),
            "slide4_html": get_screenshot_html("Virtual cost vs profit analysis unit scale.png", "Visualize True Unit Economics"),
            "slide5": "Stop guessing your prices.<br><br>Click the link in bio to calculate your exact unit economics for free."
        },
        {
            "prefix": "moq",
            "bg": "pain_closet.png",
            "slide2": "Ordering 1,000 units to save /unit sounds great...<br><br><span style='color:#ff2a75;'>until ,000 of your cash flow is tied up in dead stock for 8 months.</span>",
            "slide3_html": get_screenshot_html("Calculate price flat order.png", "Model Multiple Tiers Simultaneously"),
            "slide4_html": get_screenshot_html("Virtual cost vs profit analysis flat order profit mode.png", "Find Your Break-Even Sweet Spot"),
            "slide5": "Find your brand's perfect MOQ sweet spot.<br><br>Link in bio."
        },
        {
            "prefix": "margin",
            "bg": "pain_measuring.png",
            "slide2": " in revenue means nothing if your net profit is only 5%.<br><br><span style='color:#ff2a75;'>If you don't model your margins BEFORE manufacturing, you're flying blind.</span>",
            "slide3_html": get_screenshot_html("Calculate price target margin.png", "Model Margin Scenarios Before Buying"),
            "slide4_html": get_screenshot_html("Virtual cost profit margin.png", "See Your Real Net Profit Instantly"),
            "slide5": "Model your margins before you pay your supplier.<br><br>Try the free calculator at the link below."
        }
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1080, 'height': 1350}, device_scale_factor=2)
        
        for theme in themes:
            bg_path = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'backgrounds', theme['bg'])
            b64_src = get_base64_image(bg_path) if os.path.exists(bg_path) else ""
            bg_html = f'<img id="dynamic-bg" src="{b64_src}">' if b64_src else ''
            
            def render(content_html, layout, index, filename):
                html = template_html.replace('height: 1350px;', 'height: 1350px;')
                html = html.replace('{{LAYOUT_CLASS}}', layout)
                html = html.replace('{{BG_HTML}}', bg_html)
                html = html.replace('{{SLIDE_TAG_BLOCK}}', '')
                
                # Remove Header
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
                elif layout == 'layout-pain':
                    html = html.replace('{{TEXT_CLASS}}', 'text-[3rem] leading-snug')
                    html = html.replace('{{ACCENT_CLASS}}', '')
                    html = html.replace('{{GLASS_EXTRA_CLASS}}', '')
                
                # Footer CTA
                if index == 5:
                    html = html.replace('{{SWIPE_BLOCK}}', '')
                    html = html.replace('{{CTA_BLOCK}}', '<div class="mt-16 flex justify-center"><div class="px-12 py-6 bg-[#ff2a75] text-white font-black text-2xl rounded-full tracking-wide shadow-[0_0_20px_rgba(255,42,117,0.5)]">Try the Calculator</div></div>')
                else:
                    html = html.replace('{{SWIPE_BLOCK}}', '<div class="text-[#ff2a75] text-2xl font-bold flex items-center gap-2 animate-pulse bg-black/40 px-6 py-3 rounded-full backdrop-blur-md">Swipe <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg></div>')
                    html = html.replace('{{CTA_BLOCK}}', '')

                page.set_content(html)
                page.evaluate("document.fonts.ready")
                page.wait_for_timeout(500)
                page.screenshot(path=os.path.join(base_dir, f"{theme['prefix']}_{filename}.png"))
                print(f"Generated {theme['prefix']}_{filename}.png")

            # Slide 2
            render(theme['slide2'], 'layout-pain', 2, 'slide2_trap')
            # Slide 3
            render(theme['slide3_html'], 'layout-overlay', 3, 'slide3_tool')
            # Slide 4
            render(theme['slide4_html'], 'layout-overlay', 4, 'slide4_result')
            # Slide 5
            render(theme['slide5'], 'layout-cinematic', 5, 'slide5_cta')

        browser.close()

if __name__ == "__main__":
    generate_slides()
