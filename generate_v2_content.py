import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

HOOKS = [
    "Why you should never 'buy two sizes just in case' (and how it guarantees a pile of shame in your bedroom).",
    "The biggest mistake you’re making when ordering from overseas that leaves you feeling like a giant in children's clothes.",
    "The hidden trap of supporting independent global designers that ends up costing you a fortune in international return shipping.",
    "The body-blame trap: why zipping up a 'standard size' dress almost always ends in a pre-party meltdown.",
    "The #1 reason you keep buying boring fast fashion (and how 'sizing anxiety' is suffocating your personal style).",
    "The hidden pothole of buying a suit online that guarantees you'll look like a kid playing dress-up in your dad's jacket.",
    "The 'try it at home' trap that turns your hallway into a cardboard labyrinth of unreturned boxes.",
    "Why you should never trust a brand's sizing label (and how 'vanity sizing' secretly manipulates your self-esteem).",
    "The biggest mistake women make when shopping a 'Final Sale' rack that leads to a closet full of clothes with the tags still on.",
    "The hidden denim trap that forces women with curves to choose between crushed thighs and a massive waist gap.",
    "The sizing pothole that guarantees every pair of wide-leg pants you order will end up looking like awkward capris.",
    "The biggest mistake you make when buying a maxi dress online that ensures it becomes an accidental floor mop.",
    "The 'free shipping' trap that secretly penalizes your bank account when the brand's size chart inevitably lies to you.",
    "Why you should never just 'size up' to get an oversized look (and how it ends up swallowing your figure completely).",
    "The biggest mistake you can make when buying clothes for a loved one that practically guarantees an awkward trip to the return counter.",
    "The hidden trap of '100% rigid cotton' denim that leaves you suffocating and completely unable to sit down.",
    "Why you should never trust the size tag on vintage clothing (and how a 90s 'Size Large' will shatter your confidence today).",
    "The #1 mistake you make when your body changes that leaves you staring at a full closet with absolutely nothing to wear.",
    "The sizing pothole that punishes athletic builds and guarantees your 'slim fit' shirt will rip at the shoulders.",
    "Why you should never play the 'shrink to fit' laundry gamble (and how it destroys your favorite shirt in a single wash).",
    "The hidden manufacturing trap that ensures your black shirt fits perfectly, but the white one in the exact same size feels like a straitjacket.",
    "The biggest mistake footwear brands make that turns buying knee-high boots into a humiliating exercise in calf-squeezing.",
    "The cruel 'buy your pre-pregnancy size' lie that leaves expectant mothers feeling uncomfortable and completely unsupported.",
    "The hidden sizing chasm between an 'XL' and a '1X' that is specifically designed to make you question your worth.",
    "The 'great deal' trap that ends up costing you double once you realize you have to pay a tailor to fix the waist.",
    "Why you should never buy 'unisex' clothing if you don't want your natural curves erased by a shapeless cardboard box.",
    "The #1 reason you can't share clothes with a friend who weighs exactly the same as you (and why body geometry matters more).",
    "The hidden pothole of buying a work blouse online that leaves you terrified of bending over in the office.",
    "Why you should never buy a swimwear set online (and how it guarantees a confidence-crushing mirror check before the beach).",
    "The biggest mistake you’re making in 2026: trusting a 100-year-old tape measure to navigate modern fashion algorithms."
]

def generate_waitlist_posts(batch_hooks, start_day):
    print(f"Generating batch starting at day {start_day}...")
    
    hooks_text = ""
    for i, hook in enumerate(batch_hooks):
        hooks_text += f"Day {start_day + i}: {hook}\n"
    
    prompt = f"""
You are the founder of STYLA Measure, a "Perfect-Fit Fashion Marketplace" that uses smartphone body-scanning to end online shopping returns.

YOUR TASK:
Write social media carousels based on the exact Hooks provided below. DO NOT change the Hook text. 

For the body of the post, use the 4 Fashion-Tech Pillars:
1. Inclusivity & Validation (Attack 'standard sizing')
2. Industry Secrets (Expose brand manipulation)
3. Frictionless Transformation (The old painful way vs the STYLA way)
4. Sustainability (Exposing the environmental/financial guilt of returns)

Also, tap into deep emotional pain: Humiliation, Inadequacy, Exclusion, and Loss of Joy.

Here are the hooks to use:
{hooks_text}

For each day, output EXACTLY this format:

### Day [Number]: [Topic Title (Make it up, short)]
**Hook:** [USE THE EXACT HOOK PROVIDED ABOVE. DO NOT ALTER IT.]
**Problem:** [Agitate the deep emotional pain and explain the industry secret/flaw causing it.]
**Solution:** [Introduce STYLA Measure as the frictionless paradigm shift. "Stop guessing..."]
**CTA:** Stop guessing your size. Drop the size chart into the STYLA AI Decoder. Link in bio.

Make the tone rebellious, deeply empathetic, and visionary.
"""
    
    response = model.generate_content(prompt)
    return response.text

if __name__ == "__main__":
    print("STYLA Measure - 30 Day V2 Pain Engine Started")
    
    all_output = "# Generated V2 Emotion Posts\n\n"
    
    for i in range(0, 30, 10):
        batch = HOOKS[i:i+10]
        result = generate_waitlist_posts(batch, i+1)
        all_output += result + "\n\n"
    
    with open("pain_engine_output_v2.md", "w", encoding="utf-8") as f:
        f.write(all_output)

    print("\nSuccessfully generated 30 high-converting v2 posts!")
    print("Output saved to: pain_engine_output_v2.md")
