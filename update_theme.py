import os

files_to_update = ['style.css', 'index.html', 'decoder.html']
cwd = os.getcwd()

replacements = {
    '#8b5cf6': '#ff2a75',
    '#a78bfa': '#ff75a0',
    '139, 92, 246': '255, 42, 117',
    '139,92,246': '255,42,117',
    '#7c3aed': '#e6004c',
    '#9d6eff': '#ff4d8c',
    '#a5b4fc': '#ff75a0',
    '#6d28d9': '#d90040',
    '--pink: #ec4899;': '--pink: #ff0055;'
}

for filename in files_to_update:
    path = os.path.join(cwd, filename)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        for old_val, new_val in replacements.items():
            content = content.replace(old_val, new_val)
            
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filename}")
