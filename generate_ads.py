# -*- coding: utf-8 -*-
import os
import base64
from playwright.sync_api import sync_playwright

def get_base64_image(filepath):
    if not os.path.exists(filepath):
        return ""
    with open(filepath, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    return f"data:image/png;base64,{encoded_string}"

def get_base_html(logo_b64, width, height, headline, subheadline, visual_content, is_landscape):
    """
    Common base template for all ads:
    - Pure flat black background (#000000)
    - White & Styla pink (#ff2a75) theme
    - Side-by-side layout (Left copy, Right visual proof)
    """
    logo_align = "justify-start"
    
    if is_landscape:
        headline_size = "text-[3.6rem] font-black leading-[1.05] tracking-tighter"
        desc_size = "text-xl font-bold leading-relaxed"
        content_padding = "py-6"
    else: # Square 1:1
        headline_size = "text-[2.6rem] font-black leading-[1.05] tracking-tighter"
        desc_size = "text-[1.2rem] font-bold leading-relaxed"
        content_padding = "py-4"

    return f'''
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Outfit:wght@800;900&display=swap" rel="stylesheet">
      <style>
        body {{
          background-color: #000000;
          font-family: 'Inter', sans-serif;
        }}
        .font-outfit {{
          font-family: 'Outfit', sans-serif;
        }}
        .phone-shadow {{
          box-shadow: 0 0 50px rgba(255, 42, 117, 0.35);
        }}
      </style>
    </head>
    <body class="w-[{width}px] h-[{height}px] bg-black text-white overflow-hidden flex flex-col p-16 justify-between">
      
      <!-- Top Bar / Logo -->
      <div class="flex items-center gap-3 {logo_align} z-10">
        {f'<img src="{logo_b64}" class="h-10 w-10 rounded-full border-2 border-[#ff2a75]">' if logo_b64 else '<div class="w-10 h-10 bg-[#ff2a75] rounded-full flex items-center justify-center font-black text-xl">S</div>'}
        <span class="font-outfit text-2xl font-black tracking-wider text-white">STYLA <span class="text-[#ff2a75]">MEASURE</span></span>
      </div>

      <!-- Main Content (Always Side-by-Side Left/Right layout) -->
      <div class="flex flex-row items-center justify-between z-10 my-auto {content_padding} gap-12">
        
        <!-- Left Side: Copy -->
        <div class="w-[54%] flex flex-col justify-center">
          <h1 class="font-outfit {headline_size} leading-[1.02] text-white mb-8 uppercase">
            {headline}
          </h1>
          <p class="text-white {desc_size} border-l-4 border-[#ff2a75] pl-6">
            {subheadline}
          </p>
        </div>

        <!-- Right Side: Visual Proof -->
        <div class="w-[42%] flex items-center justify-center">
          {visual_content}
        </div>

      </div>

      <!-- Footer Bar -->
      <div class="flex items-center justify-between border-t border-white/20 pt-6 text-sm text-gray-200 z-10 font-bold uppercase tracking-wider">
        <span>No manual tape measure. No sizing errors.</span>
        <span class="font-black text-3xl text-[#ff2a75] font-outfit tracking-widest">styla.ca</span>
      </div>

    </body>
    </html>
    '''

# --- Visual Renderers ---

def get_phone_mockup(screenshot_b64, fallback_html, height):
    """Wraps content inside a clean smartphone bezel with shadow"""
    if screenshot_b64:
        return f'''
        <div class="phone-shadow relative mx-auto {height} aspect-[9/19.5] rounded-[36px] border-[10px] border-[#151520] bg-black overflow-hidden flex items-center justify-center">
          <img src="{screenshot_b64}" class="w-full h-full object-contain">
        </div>
        '''
    else:
        return f'''
        <div class="phone-shadow relative mx-auto {height} aspect-[9/19.5] rounded-[36px] border-[10px] border-[#151520] bg-black p-5 flex flex-col justify-between text-white">
          {fallback_html}
        </div>
        '''

def get_invoice_card():
    """Ad 1 Var 2: Sizing Alteration Invoice Visual Card"""
    return '''
    <div class="phone-shadow w-full max-w-[380px] bg-black border-2 border-[#ff2a75] rounded-3xl p-6 text-white relative">
      <div class="border-b border-white/10 pb-3 mb-4">
        <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">Sizing Alterations</span>
        <h3 class="font-outfit text-lg font-black uppercase text-white">Invoice #9024</h3>
      </div>
      
      <div class="flex flex-col gap-3 mb-6 text-sm">
        <div class="flex justify-between border-b border-white/5 pb-2">
          <span>Shoulders Rebuild</span><span class="font-bold font-outfit text-white">$85.00</span>
        </div>
        <div class="flex justify-between border-b border-white/5 pb-2">
          <span>Sleeve Shortening</span><span class="font-bold font-outfit text-white">$40.00</span>
        </div>
        <div class="flex justify-between border-b border-white/5 pb-2">
          <span>Waist Suppression</span><span class="font-bold font-outfit text-white">$35.00</span>
        </div>
      </div>
      
      <div class="flex justify-between items-center border-t border-white/20 pt-4 mb-4">
        <span class="text-xs text-gray-400 font-bold uppercase">Landed Cost</span>
        <span class="text-2xl font-black font-outfit text-[#ff2a75]">$160.00</span>
      </div>
      
      <!-- Cancelled Stamp -->
      <div class="absolute top-[40%] left-[20%] rotate-[-12deg] border-4 border-[#ff2a75] px-6 py-2 rounded-xl text-3xl font-black text-[#ff2a75] bg-black uppercase tracking-wider">
        Cancelled
      </div>
      
      <div class="bg-white/5 rounded-xl p-3 text-center border border-[#ff2a75]/30">
        <span class="text-xs text-emerald-400 font-black block">STYLA MEASURE COST: $0.00</span>
      </div>
    </div>
    '''

def get_timeline_card():
    """Ad 1 Var 3: Timeline Stress Calendar Visual Card"""
    return '''
    <div class="phone-shadow w-full max-w-[380px] bg-black border-2 border-white rounded-3xl p-6 text-white relative">
      <div class="border-b border-white/10 pb-3 mb-4 flex justify-between items-center">
        <h3 class="font-outfit text-sm font-black uppercase text-white">Tailor Timeline Alert</h3>
        <span class="w-3.5 h-3.5 rounded-full bg-[#ff2a75] animate-pulse"></span>
      </div>
      
      <div class="flex flex-col gap-4 mb-6">
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-400">1</div>
          <div>
            <span class="text-[10px] text-gray-400 block uppercase font-bold">Day 1</span>
            <span class="text-xs font-bold text-white">Suit Arrives (Sleeves too short)</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-400">2</div>
          <div>
            <span class="text-[10px] text-gray-400 block uppercase font-bold">Day 2</span>
            <span class="text-xs font-bold text-white">Local Tailor Backlog (Wait: 14 days)</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-full bg-[#ff2a75]/20 border border-[#ff2a75] flex items-center justify-center text-xs font-bold text-[#ff2a75]">3</div>
          <div>
            <span class="text-[10px] text-[#ff2a75] block uppercase font-black">Day 3 ⚠️</span>
            <span class="text-xs font-black text-white">The Wedding / Event Day</span>
          </div>
        </div>
      </div>
      
      <div class="bg-[#ff2a75]/10 border border-[#ff2a75] rounded-xl p-3 text-center">
        <span class="text-xs font-black text-white uppercase block">Scan Day 1. Fit on Arrival.</span>
      </div>
    </div>
    '''

def get_return_log_card():
    """Ad 2 Var 2: Sizing Return Log Checklist Visual Card"""
    return '''
    <div class="phone-shadow w-full max-w-[380px] bg-black border-2 border-[#ff2a75] rounded-3xl p-6 text-white">
      <div class="border-b border-white/10 pb-3 mb-4">
        <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">Active Returns</span>
        <h3 class="font-outfit text-lg font-black uppercase text-white">Sizing Return Log</h3>
      </div>
      
      <div class="flex flex-col gap-3 mb-6">
        <div class="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl p-3">
          <span class="text-xs font-bold text-slate-300">Zara Shirt (M)</span>
          <span class="text-[10px] font-black text-[#ff2a75] bg-[#ff2a75]/10 border border-[#ff2a75]/30 px-2 py-0.5 rounded uppercase">Too Tight</span>
        </div>
        <div class="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl p-3">
          <span class="text-xs font-bold text-slate-300">Abercrombie Hoodie (M)</span>
          <span class="text-[10px] font-black text-[#ff2a75] bg-[#ff2a75]/10 border border-[#ff2a75]/30 px-2 py-0.5 rounded uppercase">Too Baggy</span>
        </div>
        <div class="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl p-3">
          <span class="text-xs font-bold text-slate-300">Levi's Denim (32)</span>
          <span class="text-[10px] font-black text-[#ff2a75] bg-[#ff2a75]/10 border border-[#ff2a75]/30 px-2 py-0.5 rounded uppercase">Waist Gap</span>
        </div>
      </div>
      
      <div class="bg-white text-black rounded-xl p-3.5 text-center border-2 border-white font-black text-sm uppercase">
        Measure Once. Return Zero.
      </div>
    </div>
    '''

def get_comparison_chart_card():
    """Ad 2 Var 3: Sizing Chart Bar/Stack Visual Card"""
    return '''
    <div class="phone-shadow w-full max-w-[380px] bg-black border-2 border-white rounded-3xl p-6 text-white">
      <div class="border-b border-white/10 pb-3 mb-4">
        <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">Sizing Discrepancy Chart</span>
        <h3 class="font-outfit text-lg font-black uppercase text-white">The "Medium" Sizing Lie</h3>
      </div>
      
      <div class="flex flex-col gap-4 mb-6">
        <!-- Zara -->
        <div>
          <div class="flex justify-between text-xs mb-1 font-bold text-slate-300">
            <span>Zara (Medium)</span><span>39" Chest</span>
          </div>
          <div class="w-full bg-slate-900 rounded-full h-3">
            <div class="bg-slate-700 h-3 rounded-full" style="width: 60%"></div>
          </div>
        </div>
        
        <!-- Nike -->
        <div>
          <div class="flex justify-between text-xs mb-1 font-bold text-slate-300">
            <span>Nike (Medium)</span><span>42" Chest</span>
          </div>
          <div class="w-full bg-slate-900 rounded-full h-3">
            <div class="bg-[#ff2a75] h-3 rounded-full" style="width: 75%"></div>
          </div>
        </div>
        
        <!-- Abercrombie -->
        <div>
          <div class="flex justify-between text-xs mb-1 font-bold text-slate-300">
            <span>Abercrombie & Fitch (Medium)</span><span>46" Chest</span>
          </div>
          <div class="w-full bg-slate-900 rounded-full h-3">
            <div class="bg-white h-3 rounded-full" style="width: 100%"></div>
          </div>
        </div>
      </div>
      
      <div class="bg-[#ff2a75]/10 border border-[#ff2a75] rounded-xl p-3 text-center text-xs font-black uppercase">
        Same size label. 7 inches of difference.
      </div>
    </div>
    '''

def run_ad_generation():
    output_dir = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'ads')
    os.makedirs(output_dir, exist_ok=True)
    
    logo_path = os.path.join(os.path.dirname(__file__), 'logo.png')
    logo_b64 = get_base64_image(logo_path)
    
    # Check for real screenshots provided by the user (supporting both png, jpg, jpeg)
    def find_screenshot(name):
        screenshots_dir = os.path.join(os.path.dirname(__file__), 'marketing_assets', 'screenshots')
        for ext in ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG']:
            path = os.path.join(screenshots_dir, f"{name}{ext}")
            if os.path.exists(path):
                return path
        return ""

    wedding_path = find_screenshot('wedding_scan')
    decoder_path = find_screenshot('size_decoder')
    
    wedding_b64 = get_base64_image(wedding_path) if wedding_path else ""
    decoder_b64 = get_base64_image(decoder_path) if decoder_path else ""
    
    formats = [
        {"name": "square", "w": 1080, "h": 1080},
        {"name": "landscape", "w": 1920, "h": 1080}
    ]
    
    print("Launching Playwright Ad Generator...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        for fmt in formats:
            w, h = fmt["w"], fmt["h"]
            suffix = fmt["name"]
            is_landscape = w > h
            phone_h = "h-[750px]" if is_landscape else "h-[620px]"
            page = browser.new_page(viewport={'width': w, 'height': h}, device_scale_factor=2)
            
            # ==========================================
            # AD 1: REMOTE SIZING / WEDDINGS
            # ==========================================
            
            # --- Ad 1, Version A: Original (Chosen Option B Slogan) ---
            headline = "Need tailored measurements <span class='text-[#ff2a75] block'>for a remote tailor?</span>"
            subheadline = "Styla takes accurate measurements at the convenience of your home using your mobile phone."
            fallback_html = '''
            <div class="flex justify-between items-center mt-6">
              <span class="text-[10px] font-black text-white bg-[#ff2a75] px-2 py-0.5 rounded">SCANNING MODE</span>
              <span class="text-[10px] font-black text-emerald-400 bg-emerald-950 border border-emerald-500 px-2 py-0.5 rounded">98% ACCURACY</span>
            </div>
            <div class="my-auto border-2 border-dashed border-[#ff2a75] rounded-2xl h-[55%] flex items-center justify-center bg-slate-950">
              <span class="text-xs text-white/50">Camera Scanning...</span>
            </div>
            '''
            visual_content = get_phone_mockup(wedding_b64, fallback_html, phone_h)
            ad_1_html = get_base_html(logo_b64, w, h, headline, subheadline, visual_content, is_landscape)
            
            page.set_content(ad_1_html)
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(500)
            page.screenshot(path=os.path.join(output_dir, f"ad_remote_measurements_v1_{suffix}.png"))
            
            # --- Ad 1, Version B: Sizing Alteration Bill ---
            headline = "Avoid the $150 <span class='text-[#ff2a75] block'>alteration bill.</span>"
            subheadline = "Skip the tape measure guesswork. Get tailor-grade body measurements from home in 60 seconds."
            visual_content = get_invoice_card()
            ad_1_html_v2 = get_base_html(logo_b64, w, h, headline, subheadline, visual_content, is_landscape)
            
            page.set_content(ad_1_html_v2)
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(500)
            page.screenshot(path=os.path.join(output_dir, f"ad_remote_measurements_v2_{suffix}.png"))

            # --- Ad 1, Version C: Timeline Stress ---
            headline = "Fitting errors are <span class='text-[#ff2a75] block'>impossible to fix on time.</span>"
            subheadline = "When your tailor is in another state, a bad fit is a nightmare. Scan with Styla for a perfect first-time fit."
            visual_content = get_timeline_card()
            ad_1_html_v3 = get_base_html(logo_b64, w, h, headline, subheadline, visual_content, is_landscape)
            
            page.set_content(ad_1_html_v3)
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(500)
            page.screenshot(path=os.path.join(output_dir, f"ad_remote_measurements_v3_{suffix}.png"))
            
            # ==========================================
            # AD 2: CROSS-BRAND SIZING FINDER
            # ==========================================
            
            # --- Ad 2, Version A: Original size decoder popup ---
            headline = "Find your perfect size <span class='text-[#ff2a75] block'>across all brands.</span>"
            subheadline = "Find out how on <span class='font-black text-[#ff2a75]'>styla.ca</span>"
            fallback_html = '''
            <div class="mt-6 border-b border-white/10 pb-2">
              <span class="text-[10px] font-black text-[#ff2a75]">STYLA SIZE DECODER</span>
            </div>
            <div class="my-auto flex flex-col gap-2">
              <div class="bg-slate-900 border border-slate-800 rounded-lg p-3 flex justify-between text-xs">
                <span>Zara</span><span class="font-bold">Size L</span>
              </div>
            </div>
            '''
            visual_content = get_phone_mockup(decoder_b64, fallback_html, phone_h)
            ad_2_html = get_base_html(logo_b64, w, h, headline, subheadline, visual_content, is_landscape)
            
            page.set_content(ad_2_html)
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(500)
            page.screenshot(path=os.path.join(output_dir, f"ad_cross_brand_sizing_v1_{suffix}.png"))
            
            # --- Ad 2, Version B: Sizing Return Log ---
            headline = "Stop turning the post office <span class='text-[#ff2a75] block'>into your weekend run.</span>"
            subheadline = "No more buying 3 sizes of the same shirt just to return 2. Decode your exact size across all brands."
            visual_content = get_return_log_card()
            ad_2_html_v2 = get_base_html(logo_b64, w, h, headline, subheadline, visual_content, is_landscape)
            
            page.set_content(ad_2_html_v2)
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(500)
            page.screenshot(path=os.path.join(output_dir, f"ad_cross_brand_sizing_v2_{suffix}.png"))

            # --- Ad 2, Version C: Brand Size Comparison ---
            headline = "A Medium in one brand <span class='text-[#ff2a75] block'>is an XL in another.</span>"
            subheadline = "Stop guessing your size. Styla translates your actual body measurements into the correct size for any brand."
            visual_content = get_comparison_chart_card()
            ad_2_html_v3 = get_base_html(logo_b64, w, h, headline, subheadline, visual_content, is_landscape)
            
            page.set_content(ad_2_html_v3)
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(500)
            page.screenshot(path=os.path.join(output_dir, f"ad_cross_brand_sizing_v3_{suffix}.png"))
            
        browser.close()
    
    print("\nAd Generation Complete! All versions saved in: marketing_assets/ads/")

if __name__ == "__main__":
    run_ad_generation()
