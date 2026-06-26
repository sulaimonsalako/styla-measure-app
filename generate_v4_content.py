import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

FEATURES = {
    "Styla Measure": {
        "cta": "Stop guessing your size. Drop the size chart into the STYLA AI Decoder and know for sure. Link in bio.",
        "context": "STYLA Measure is an AI body scanning and automated size decoding app. A simple smartphone scan creates a 3D digital twin to decode size charts instantly and ensure perfect fits across brands. Taps into frustration with tape measurements, sizing charts, and vanity sizing.",
        "hooks": [
            "Stop blaming brand sizing chart gaps for your online shopping anxiety.",
            "The uncomfortable truth about standard clothing size charts nobody tells you.",
            "You don't actually need a physical tape measure to fix your sizing confusion.",
            "Most people handle sizing chart comparisons completely wrong.",
            "If you think checking the model's height and weight solves your sizing worries, think again.",
            "The biggest mistake people make when dealing with sizing variations across unknown clothing brands.",
            "Why custom profile creators isn't fixing your bad-fit returns.",
            "You've probably been told the wrong thing about how to find your 'true size'.",
            "This is the real reason your wardrobe size mismatch keeps coming back.",
            "Before you accept guessing your size from brand charts as 'normal', read this."
        ]
    },
    "MOQ Calculator": {
        "cta": "Stop guessing your pricing and MOQ. Click the link in bio to use our free MOQ and unit economics calculator.",
        "context": "The STYLA MOQ Calculator helps fashion brands evaluate unit costs, freight/shipping, and break-even MOQ to prevent dead stock. It prevents cash flow lock-up by analyzing margins dynamically.",
        "hooks": [
            "Stop blaming manufacturer MOQ requirements for your locked-up cash flow.",
            "The uncomfortable truth about bulk volume discounts nobody tells you.",
            "You don't actually need 10,000 customers to fix low profit margins.",
            "Most people handle supplier MOQ negotiations completely wrong.",
            "If you think multiplying production costs by a flat 2.5x solves your retail pricing issues, think again.",
            "The biggest mistake people make when dealing with supplier MOQ calculations.",
            "Why negotiating unit prices isn't fixing your cash flow struggles.",
            "You've probably been told the wrong thing about target margins and manufacturing pricing.",
            "This is the real reason your dead stock inventory overhead keeps coming back.",
            "Before you accept low-margin production runs as 'normal', read this."
        ]
    },
    "Online Shopping": {
        "cta": "Stop return runs to the post office. Use STYLA Measure to get the perfect fit first time. Link in bio.",
        "context": "Focuses on general online shopping issues, fitting room anxiety, return cycles, and post office trips. Promotes STYLA Measure as the ultimate solution for stress-free online shopping.",
        "hooks": [
            "Stop blaming your body shape for your online shopping disappointment.",
            "The uncomfortable truth about the online return cycle nobody tells you.",
            "You don't actually need to order three different sizes to fix your fit concerns.",
            "Most people handle online sizing uncertainty completely wrong.",
            "If you think ordering the same size across all e-commerce sites solves your wardrobe fitting issues, think again.",
            "The biggest mistake people make when dealing with online return rates.",
            "Why relying on customer reviews saying 'runs small' isn't fixing your sizing returns.",
            "You've probably been told the wrong thing about how online sizing grades work.",
            "This is the real reason your pile of unworn clothes with tags keeps coming back.",
            "Before you accept returning half your shopping cart as 'normal', read this."
        ]
    },
    "Shopping from African Brands": {
        "cta": "Stop sizing anxiety with remote tailoring. Use STYLA Measure to get your exact digital spec sheet. Link in bio.",
        "context": "Focuses on bespoke custom tailoring, traditional fabrics (like Ankara/Kente), global sizing mismatch (US vs UK vs local tailoring), and high return shipping costs. Shows how STYLA generates an exact 3D spec sheet for remote tailors.",
        "hooks": [
            "Stop blaming overseas tailors for your closet full of beautiful Ankara outfits you can't squeeze into.",
            "The uncomfortable truth about buying custom African fashion online nobody tells you.",
            "You don't actually need to see a local tailor in person to fix sizing errors on your overseas custom apparel orders.",
            "Most people handle sizing measurements for custom African brands completely wrong.",
            "If you think using a standard US/UK size converter solves sizing mismatches with African designers, think again.",
            "The biggest mistake people make when dealing with measurements for custom African clothing.",
            "Why sending standard retail sizes (like S/M/L) isn't fixing your custom tailoring errors.",
            "You've probably been told the wrong thing about ordering bespoke African clothing online.",
            "This is the real reason your ill-fitting custom African outfits keep coming back.",
            "Before you accept paying for custom African wear and just 'hoping it fits' as 'normal', read this."
        ]
    }
}

def generate_all_posts():
    output = "# Generated V4 Feature Posts\n\n"
    
    for feature_name, feature_data in FEATURES.items():
        print(f"Generating posts for feature: {feature_name}...")
        output += f"## Feature: {feature_name}\n\n"
        
        hooks_text = ""
        for i, hook in enumerate(feature_data["hooks"]):
            hooks_text += f"Hook {i+1}: {hook}\n"
            
        prompt = f"""
You are the marketing lead of STYLA Measure.
Feature / Tool: {feature_name}
Context: {feature_data["context"]}

YOUR TASK:
Write 10 highly engaging social media carousel posts (one for each hook below) specifically focused on the pain points and solutions for this feature.
DO NOT change the Hook text. 

For the body of the post:
- Tap into deep emotional pain points: Frustration, wasted money, confusion, dead inventory, or regret.
- Keep the tone direct, benefit-driven, and clear.

Here are the hooks to use:
{hooks_text}

For each hook, output EXACTLY this format (substituting [Number] and details accordingly):

### {feature_name} - Post [Number]
**Hook:** [USE THE EXACT HOOK PROVIDED ABOVE. DO NOT ALTER IT.]
**Problem:** [Explain the specific pain/problem addressed by the hook.]
**Solution:** [Explain how STYLA Measure solves it for this feature.]
**CTA:** {feature_data["cta"]}

---
"""
        
        response = model.generate_content(prompt)
        output += response.text + "\n\n"
        
    return output

if __name__ == "__main__":
    print("STYLA Measure - V4 Multi-Feature Pain Engine Started")
    result = generate_all_posts()
    
    output_path = "pain_engine_output_v4.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(result)
        
    print(f"\nSuccessfully generated 40 posts across 4 features!")
    print(f"Output saved to: {output_path}")
