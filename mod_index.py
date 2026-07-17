import sys
with open("index.html", "r", encoding="utf-8") as f: c = f.read()
t1 = "<button class=\"btn-run btn-apple-shortcut-action\" style=\"margin-top: 1rem; text-align: center; width: 100%; padding: 10px; font-size: 0.85rem; background: var(--primary-gradient); border: none; border-radius: 8px; cursor: pointer; color: #fff; font-weight: 700;\">Open iPad & Apple Setup Guide</button>"
r1 = "<button disabled style=\"margin-top: 1rem; text-align: center; width: 100%; padding: 10px; font-size: 0.85rem; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; cursor: not-allowed; color: var(--text-muted); font-weight: 700; opacity: 0.75;\">Safari Extension (Coming Soon)</button>"
t2 = "<a href=\"javascript:void(0)\" class=\"btn-run btn-apple-shortcut-action\" style=\"display: block; text-align: center; text-decoration: none; width: 100%; padding: 12px; font-size: 0.9rem; font-weight: 700; background: var(--primary-gradient); border-radius: 10px;\">Install Apple Shortcut</a>"
r2 = "<button disabled style=\"display: block; text-align: center; text-decoration: none; width: 100%; padding: 12px; font-size: 0.9rem; font-weight: 700; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; cursor: not-allowed; color: var(--text-muted); opacity: 0.75;\">Safari Extension (Coming Soon)</button>"
if t1 in c and t2 in c:
    c = c.replace(t1, r1).replace(t2, r2)
    with open("index.html", "w", encoding="utf-8") as out: out.write(c)
    print("SUCCESS")
else: print("FAIL", t1 in c, t2 in c)
