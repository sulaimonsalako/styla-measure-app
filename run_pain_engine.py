import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Load keys
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not GOOGLE_API_KEY:
    print("❌ ERROR: GOOGLE_API_KEY not found in .env")
    exit(1)

genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

TOPICS = [
    "1. The 'Two Sizes' Trap (Bracketing / Buying multiple sizes)",
    "2. Asian Sizing vs US/EU (The Alibaba nightmare)",
    "3. International Shipping fears (Wanting to support global designers but terrified of sizing)",
    "4. Undersized Dress Trauma (Hips/Bust ignored by standard sizing)",
    "5. New Brand Anxiety (Sticking to fast fashion just because you know your size)",
    "6. The Suit Betrayal (Looking like a kid in dad's jacket)",
    "7. The 'Endless Returns' Chore (The trunk full of un-returned boxes)",
    "8. Vanity Sizing (Being a Small at Zara, Large at H&M)",
    "9. Final Sale Fear (70% off but terrified to buy because no returns)",
    "10. The Waist Gap (Athletic/Hourglass body types ignored by denim)",
    "11. The 'Tall Girl' Ankle Freeze (Every pair of pants becomes capris)",
    "12. The Petite Maxi Dress Floor Sweep",
    "13. Hidden Return Fees (Brands charging you to return their poorly made clothes)",
    "14. The 'Oversized' Trap (Looking sloppy instead of chic)",
    "15. Gift-Giver's Panic (Buying clothes for a partner and failing)",
    "16. 100% Rigid Cotton Denim Lie (Can't breathe or sit down)",
    "17. Vintage Sizing Heartbreak (90s size 32 is modern 28)",
    "18. Weight Fluctuations (A closet full of clothes and nothing fits right now)",
    "19. Slim Fit vs Athletic Fit Deception (Menswear shoulder rips)",
    "20. Shrink to Fit Gamble (Washing a shirt once and it shrinks 2 inches)",
    "21. Fast-Fashion Consistency Lie (Black shirt fits, White shirt in same size doesn't)",
    "22. Calf Width Panic (Knee-high boots never fitting)",
    "23. Maternity Sizing Void (The 'buy your pre-pregnancy size' lie)",
    "24. Plus-Size Discrepancies (The terrifying jump between Straight XL and Plus 1X)",
    "25. The Cost of Tailoring (Buying a cheap dress but spending $50 to fix the waist)",
    "26. Unisex T-Shirt Trap (Boxy cuts that ignore female hips)",
    "27. Borrowed Clothes Reality (Same weight as a friend, but completely different body geometry)",
    "28. V-Neck Plunge Risk (Buying a work shirt online and the neck drops to your navel)",
    "29. Swimwear Sizing Roulette (Top and bottom sizing almost never match)",
    "30. Tape Measure is Dead (Relying on a 100-year-old tool for modern fashion)"
]

def generate_waitlist_posts(batch_topics):
    print(f"Generating batch of {len(batch_topics)} posts...")
    
    topics_text = "\n".join(batch_topics)
    
    prompt = f"""
You are the founder of STYLA Measure, a new startup building a "Perfect-Fit Fashion Marketplace".
You use smartphone body-scanning to create a digital twin of a user, guaranteeing clothes fit perfectly before they buy them, effectively ending online shopping returns.

YOUR TASK:
Write high-emotion social media carousels for the following topics:
{topics_text}

For each topic, output EXACTLY this format:

### Day [Number]: [Topic Title]
**Hook:** [A single-mistake, high-emotion hook (NO NUMBERS IN THE HOOK!). Example: "The biggest mistake you're making..." or "Why you should never..."]
**Problem:** [Agitate the raw emotional pain: self-blame, exhaustion, guilt over the 'pile of shame', body dysmorphia, or pre-event panic.]
**Solution:** [Introduce STYLA Measure. Shift the blame from their body to the broken sizing system. "Stop the madness. Let STYLA map your body..."]
**CTA:** Stop guessing your size. Drop the size chart into the STYLA AI Decoder and know for sure. Link in bio.

Make the tone rebellious, empathetic, and visionary. Avoid corporate jargon. Ensure the hook directly hits visceral emotions.
"""
    
    response = model.generate_content(prompt)
    return response.text

if __name__ == "__main__":
    print("STYLA Measure - 30 Day Pain Engine Started")
    
    all_output = "# Generated 30-Day Emotion Posts\n\n"
    
    # Process in batches of 10
    for i in range(0, 30, 10):
        batch = TOPICS[i:i+10]
        result = generate_waitlist_posts(batch)
        all_output += result + "\n\n"
    
    with open("pain_engine_output.md", "w", encoding="utf-8") as f:
        f.write(all_output)

    print("\nSuccessfully generated 30 high-converting waitlist posts!")
    print("Output saved locally to: pain_engine_output.md")
