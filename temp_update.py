import os

base_dir = r"C:\Users\suloa\.gemini\antigravity\DEV Apps\STYLA-measure"
template_path = os.path.join(base_dir, 'marketing_assets', 'template.html')
gen_path = os.path.join(base_dir, 'generate_carousels.py')

# 1. Update template.html
with open(template_path, 'r', encoding='utf-8') as f:
    template_html = f.read()

old_tag = '''<!-- Slide Tag -->
      <div class="text-styla-pink tracking-widest uppercase text-xl font-bold mb-6 drop-shadow-[0_0_8px_rgba(255,42,117,0.5)] flex items-center gap-3">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        {{SLIDE_TAG}}
      </div>'''

if '{{SLIDE_TAG_BLOCK}}' not in template_html:
    template_html = template_html.replace(old_tag, '{{SLIDE_TAG_BLOCK}}')
    with open(template_path, 'w', encoding='utf-8') as f:
        f.write(template_html)

# 2. Update generate_carousels.py
with open(gen_path, 'r', encoding='utf-8') as f:
    gen_code = f.read()

tag_logic = '''
                if tag:
                    tag_html = f'<div class="text-styla-pink tracking-widest uppercase text-xl font-bold mb-6 drop-shadow-[0_0_8px_rgba(255,42,117,0.5)] flex items-center gap-3"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>{tag}</div>'
                    html = html.replace('{{SLIDE_TAG_BLOCK}}', tag_html)
                else:
                    html = html.replace('{{SLIDE_TAG_BLOCK}}', '')
'''

if "{{SLIDE_TAG}}" in gen_code:
    gen_code = gen_code.replace("html = html.replace('{{SLIDE_TAG}}', tag)", tag_logic.strip())

gen_code = gen_code.replace('render_slide(hook, "THE TRAP"', 'render_slide(hook, ""')

selection_logic = '''
            text_context = f"{hook} {pain} {solution} {cta}".lower()
            
            # Select model based on context
            if any(w in text_context for w in ['suit', 'guy', 'man', 'men', 'he', 'his', 'boyfriend', 'dad']):
                selected_model = 'male_model_1.png' if idx % 2 == 0 else 'male_model_2.png'
            elif any(w in text_context for w in ['mom', 'woman', 'women', 'she', 'her', 'hers', 'girlfriend', 'dress']):
                selected_model = 'female_model_1.png' if idx % 2 == 0 else 'female_model_2.png'
            else:
                selected_model = models[idx % len(models)]
                
            # Select pain bg based on context
            if any(w in text_context for w in ['return', 'shipping', 'box', 'package', 'mail']):
                selected_pain_bg = 'pain_boxes.png'
            elif any(w in text_context for w in ['closet', 'wardrobe', 'wear', 'clothes']):
                selected_pain_bg = 'pain_closet.png'
            elif any(w in text_context for w in ['measur', 'tape', 'guess', 'chart', 'number', 'size']):
                selected_pain_bg = 'pain_measuring.png'
            else:
                selected_pain_bg = pain_bgs[idx % len(pain_bgs)]
'''

old_selection = '''
            selected_model = models[idx % len(models)]
            selected_pain_bg = pain_bgs[idx % len(pain_bgs)]
'''

if "selected_model = models[idx" in gen_code:
    gen_code = gen_code.replace(old_selection.strip(), selection_logic.strip())

with open(gen_path, 'w', encoding='utf-8') as f:
    f.write(gen_code)
print("Success")
