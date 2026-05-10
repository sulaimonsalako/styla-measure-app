from PIL import Image

def process_logo():
    try:
        img = Image.open("logo.jpg").convert("RGBA")
    except Exception as e:
        print("Could not open logo.jpg:", e)
        return

    pixels = img.load()
    width, height = img.size

    # The brand pink is roughly (255, 42, 117)
    brand_r, brand_g, brand_b = 255, 42, 117

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            
            # Using the Green channel as an alpha mask indicator.
            # Pure white has G=255. Pink has G~42.
            if g >= 240 and r >= 240 and b >= 240:
                # Definitely white background
                pixels[x, y] = (255, 255, 255, 0)
            else:
                # Anti-aliasing edges
                # Calculate alpha based on how close to white it is
                # A simple average brightness:
                brightness = (r + g + b) / 3
                if brightness > 200:
                    # It's a fringe pixel. Make it brand pink but semi-transparent.
                    # brightness 200 -> alpha 255, brightness 255 -> alpha 0
                    alpha = int(255 - ((brightness - 200) * 255 / 55))
                    alpha = max(0, min(255, alpha))
                    pixels[x, y] = (brand_r, brand_g, brand_b, alpha)
                else:
                    # Solid logo pixel
                    pixels[x, y] = (r, g, b, 255)

    img.save("logo.png", "PNG")
    print("Successfully created transparent logo.png")

process_logo()
