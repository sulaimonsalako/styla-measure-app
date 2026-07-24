
import sys
with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'btn-apple-shortcut-action' in l:
        print(i, l)
