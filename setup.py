"""
STYLA Measure — One-Command Setup
----------------------------------
What this does:
  1. Reads your Airtable PAT from .env
  2. Creates a new Airtable base called "STYLA Measure"
  3. Creates a "Waitlist" table with the right columns
  4. Injects the credentials into main.js automatically
  5. Tells you exactly how to deploy in 30 seconds

Usage:
  python setup.py
"""

import os, re, json, sys
import urllib.request, urllib.error

# ── 1. LOAD .env ──────────────────────────────────────────────
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        print("❌  .env file not found. Create one with AIRTABLE_PAT=your_token")
        sys.exit(1)
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

load_env()

PAT = os.environ.get("AIRTABLE_PAT", "")
if not PAT or PAT == "your_airtable_pat_here":
    print("\n❌  Please open .env and paste your Airtable Personal Access Token.")
    print("   Get it from: https://airtable.com/create/tokens\n")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {PAT}",
    "Content-Type":  "application/json",
}

def airtable_request(method, url, body=None):
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        error = json.loads(e.read())
        print(f"\n❌  Airtable error: {error.get('error', {}).get('message', e)}")
        sys.exit(1)

# ── 2. CREATE BASE ────────────────────────────────────────────
print("\n🚀 STYLA Measure Setup")
print("─" * 40)
print("📦 Creating Airtable base...")

# We need a workspace ID — fetch available workspaces
workspaces = airtable_request("GET", "https://api.airtable.com/v0/meta/workspaces")
workspace_id = workspaces["workspaces"][0]["id"]

base_payload = {
    "name":        "STYLA Measure",
    "workspaceId": workspace_id,
    "tables": [
        {
            "name":   "Waitlist",
            "fields": [
                {"name": "Email",         "type": "email"},
                {"name": "Sign Up Date",  "type": "date",   "options": {"dateFormat": {"name": "iso"}}},
                {"name": "Source",        "type": "singleLineText"},
                {"name": "Notes",         "type": "multilineText"},
            ]
        }
    ]
}

result   = airtable_request("POST", "https://api.airtable.com/v0/meta/bases", base_payload)
base_id  = result["id"]
print(f"   ✅ Base created  → {base_id}")

# ── 3. INJECT INTO main.js ────────────────────────────────────
print("🔧 Injecting credentials into main.js...")

js_path = os.path.join(os.path.dirname(__file__), "main.js")
with open(js_path, "r") as f:
    content = f.read()

content = re.sub(
    r"const AIRTABLE_TOKEN\s*=\s*'[^']*'",
    f"const AIRTABLE_TOKEN  = '{PAT}'",
    content
)
content = re.sub(
    r"const AIRTABLE_BASE\s*=\s*'[^']*'",
    f"const AIRTABLE_BASE   = '{base_id}'",
    content
)

with open(js_path, "w") as f:
    f.write(content)

print(f"   ✅ main.js updated with base ID and token")

# ── 4. DONE — tell user exactly what to do next ───────────────
print("\n" + "─" * 40)
print("✅  Setup complete! Your waitlist is ready.\n")
print("📋 ONE LAST STEP — Deploy your landing page (30 seconds):\n")
print("   1. Go to:  https://app.netlify.com/drop")
print("   2. Drag this entire folder into the browser:")
print(f"      {os.path.dirname(os.path.abspath(__file__))}")
print("   3. Netlify gives you a live URL instantly.\n")
print("   That's it. Share the link and start collecting signups. 🎯")
print("─" * 40 + "\n")
