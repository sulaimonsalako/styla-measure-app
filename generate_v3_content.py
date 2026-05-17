import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

HOOKS = [
    "This website tells you what size to order from any fashion brand.",
    "check out this app before you buy your next suit.",
    "This app helps saves you multiple trips to the post office.",
    "If you buy clothes online, this app is a must.",
    "Before you waste money buying another wrong size, check out this app.",
    "Will this dress fit me when it arrives?",
    "Size exhaustion.",
    "Buy clothes with confidence, every time.",
    "How would this fit me? Let our AI tell you, shop smartly with confidence.",
    "I bought my mom the wrong size on her birthday. How i wish I knew about this app.",
    "Waste $200 or use a free tool. There's only one smart choice.",
    "Buy from any brand or website confidently."
]

def generate_user_posts():
    print(f"Generating {len(HOOKS)} posts from user hooks...")
    
    hooks_text = ""
    for i, hook in enumerate(HOOKS):
        hooks_text += f"Idea {i+1}: {hook}\n"
    
    prompt = f"""
You are the founder of STYLA Measure, a "Perfect-Fit Fashion Marketplace" that uses smartphone body-scanning to end online shopping returns.

YOUR TASK:
Write 4-slide social media carousels based on the exact Hooks provided below. DO NOT change the Hook text. 

Expand on the hook to build the body of the post. Keep the tone very direct, benefit-driven, and clear.

Here are the hooks to use:
{hooks_text}

For each idea, output EXACTLY this format:

### Day Custom_Idea_[Number]: [Topic Title (Make it up, short)]
**Hook:** [USE THE EXACT HOOK PROVIDED ABOVE. DO NOT ALTER IT.]
**Problem:** [Expand on the hook. Why is this a problem? Agitate the pain of returns, wasted money, or guessing sizes.]
**Solution:** [Introduce STYLA Measure as the ultimate solution.]
**CTA:** Stop guessing your size. Drop the size chart into the STYLA AI Decoder and know for sure. Link in bio.
"""
    
    response = model.generate_content(prompt)
    return response.text

if __name__ == "__main__":
    print("STYLA Measure - V3 User Hook Engine Started")
    result = generate_user_posts()
    
    with open("pain_engine_output_v3.md", "w", encoding="utf-8") as f:
        f.write("# Generated V3 User Posts\n\n")
        f.write(result)

    print("\nSuccessfully generated 12 posts from user hooks!")
    print("Output saved to: pain_engine_output_v3.md")
