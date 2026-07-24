// STYLA Journal Content Database

export const categories = [
  { id: 'bridesmaids', title: '👗 Bridesmaid Dresses', count: 48, desc: 'Find the perfect fit for your entire party.' },
  { id: 'suits', title: '🤵 Wedding Suits', count: 32, desc: 'Tailor-grade custom suit and style advice.' },
  { id: 'size-guides', title: '📏 Size Guides', count: 24, desc: 'Demystifying brand size charts and vanity sizing.' },
  { id: 'wedding-planning', title: '💍 Wedding Planning', count: 18, desc: 'Stress-free coordination guides for your big day.' },
  { id: 'tailoring', title: '🧵 Tailoring', count: 15, desc: 'Alteration timelines, costs, and expert tips.' },
  { id: 'wedding-colors', title: '🎨 Wedding Colors', count: 22, desc: 'Trending wedding palettes and styling options.' },
  { id: 'style-inspiration', title: '👠 Style Inspiration', count: 29, desc: 'Editorial silhouettes and lookbooks.' },
  { id: 'brand-reviews', title: '🏬 Brand Reviews', count: 12, desc: 'Honest fit and sizing reviews of top designers.' }
];

export const articles = [
  {
    slug: 'how-to-choose-bridesmaid-dresses-for-different-body-types',
    title: 'How to Choose Bridesmaid Dresses for Different Body Types',
    category: '👗 Bridesmaid Dresses',
    readTime: '6 min read',
    author: 'Elena Rostova',
    date: 'July 18, 2026',
    image: 'https://images.unsplash.com/photo-1520854221256-17451cc359ef?auto=format&fit=crop&w=800&q=80',
    description: 'Learn how to coordinate necklines, fabrics, and silhouettes (A-line, wrap, and empire waist) to make everyone in your bridal party feel comfortable and look cohesive.',
    content: [
      { type: 'paragraph', text: 'Coordinating bridesmaid dresses is one of the most high-stakes visual aspects of wedding planning. With different heights, curves, and style preferences, forcing a single dress design on every bridesmaid rarely ends in complete comfort.' },
      { type: 'heading', text: 'The Power of the A-Line Silhouette' },
      { type: 'paragraph', text: 'If you want to maintain a single uniform style, the A-line silhouette remains the gold standard. Cinching at the natural, smallest point of the waist and flaring gently over the hips, it creates a balanced shape that is universally flattering.' },
      { type: 'heading', text: 'Mixing Necklines to Balance Proportions' },
      { type: 'paragraph', text: 'Rather than uniform dresses, consider choosing a single color and fabric while allowing bridesmaids to select their own necklines. A V-neck or asymmetric one-shoulder design is ideal for bridesmaids with broad shoulders, as it breaks up the horizontal line and draws the eyes vertically. For bridesmaids with smaller chests, high necklines or halter shapes add sophisticated structure.' },
      { type: 'heading', text: 'The Final Sizing Rule' },
      { type: 'paragraph', text: 'When ordering, always remind your bridal party to size up if they fall between measurements. Taking in a dress that is slightly loose is simple, but letting out satin or chiffon is virtually impossible due to narrow seam allowances.' }
    ]
  },
  {
    slug: 'the-ultimate-bridesmaid-dress-timeline',
    title: 'The Ultimate Bridesmaid Dress Timeline',
    category: '💍 Wedding Planning',
    readTime: '5 min read',
    author: 'Sarah Jenkins',
    date: 'July 15, 2026',
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
    description: 'A step-by-step schedule from ordering swatches and taking measurements to booking alterations, ensuring zero last-minute fitting panics.',
    content: [
      { type: 'paragraph', text: 'Last-minute fitting panic is the primary source of wedding planning stress. Bridesmaid dresses are typically made-to-order, meaning they take months to construct and ship, followed by weeks of custom tailoring.' },
      { type: 'heading', text: '8 Months Before: Order Swatches and Select Brands' },
      { type: 'paragraph', text: 'Order fabric swatches from brands like Azazie, Revelry, or Birdy Grey. Colors look completely different in satin vs. chiffon or under natural outdoor lighting.' },
      { type: 'heading', text: '6 Months Before: Take Final Measurements and Order' },
      { type: 'paragraph', text: 'Do not guess sizes or use street clothes sizing. Use a soft tape measure to record Chest, Waist, and Hip dimensions, and place the final order. If anyone is pregnant, account for 1 to 2 sizes of growth.' },
      { type: 'heading', text: '8 Weeks Before: First Fitting' },
      { type: 'paragraph', text: 'Schedule the first alteration fitting with your local tailor. Make sure to bring the exact shoes and undergarments you plan to wear on the wedding day.' }
    ]
  },
  {
    slug: 'best-wedding-suit-colors',
    title: 'Best Wedding Suit Colors',
    category: '🤵 Wedding Suits',
    readTime: '7 min read',
    author: 'Marcus Vance',
    date: 'July 12, 2026',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
    description: 'Beyond classic black. Discover how to choose between navy, charcoal, sage green, and sand color suits based on your wedding theme and time of day.',
    content: [
      { type: 'paragraph', text: 'Choosing a wedding suit color goes beyond simply defaulting to black. Modern weddings embrace tones that complement the venue, theme, and time of day while ensuring the groom stands out from the groomsmen.' },
      { type: 'heading', text: 'Navy & Midnight Blue: The Universal Classics' },
      { type: 'paragraph', text: 'Navy suits are highly versatile and look rich under indoor lighting. For formal black-tie events, midnight blue is a premium alternative to black, appearing deeper than black under artificial lights.' },
      { type: 'heading', text: 'Terracotta & Sage: The Autumn & Spring Favorites' },
      { type: 'paragraph', text: 'Outdoor garden or rustic desert weddings call for warm, earthy tones. Terracotta and sage green suits are rising in popularity, coordinating beautifully with neutral bridesmaid palettes.' }
    ]
  },
  {
    slug: 'what-size-bridesmaid-dress-should-i-order',
    title: 'What Size Bridesmaid Dress Should I Order?',
    category: '📏 Size Guides',
    readTime: '4 min read',
    author: 'Elena Rostova',
    date: 'July 10, 2026',
    image: 'https://images.unsplash.com/photo-1520854221256-17451cc359ef?auto=format&fit=crop&w=800&q=80',
    description: 'Street sizing vs. bridal sizing explained. Learn how to map your chest, waist, and seat measurements to prevent ordering a dress that cannot close.',
    content: [
      { type: 'paragraph', text: 'One of the most shocking discoveries for first-time bridesmaids is that bridal sizes are completely different from retail clothing sizes. A bridesmaid who wears a size 6 in everyday wear is frequently a size 10 in bridal collections.' },
      { type: 'heading', text: 'The Hard Constraints: Chest and Waist' },
      { type: 'paragraph', text: 'For structured A-line dresses, the waist and bust are hard constraints. The dress has zero stretch, so if your waist is a size 10 but your bust is a size 6, you must order the size 10 to ensure it closes, and have a tailor adjust the bust.' }
    ]
  },
  {
    slug: 'how-much-do-alterations-cost',
    title: 'How Much Do Alterations Cost?',
    category: '🧵 Tailoring',
    readTime: '5 min read',
    author: 'Sarah Jenkins',
    date: 'July 05, 2026',
    image: 'https://images.unsplash.com/photo-1509319117193-57bab727e09d?auto=format&fit=crop&w=800&q=80',
    description: 'A comprehensive cost breakdown of common bridesmaid and suit tailoring tasks, helping you budget for the perfect fit.',
    content: [
      { type: 'paragraph', text: 'A perfect fit off-the-rack is a rarity. When purchasing formal wear, you should anticipate a tailoring budget as part of the overall costume expense.' },
      { type: 'heading', text: 'Average Alterations Cost Sheet' },
      { type: 'paragraph', text: 'A standard hem typically costs between $45 and $90. Taking in the waist or bust ranges from $80 to $150. Complex jobs like adjusting shoulder seams or tapering sleeves can run upwards of $200. Sizing a dress correctly initially can save you over $150 in avoidable fees.' }
    ]
  }
];

export const trending = [
  { title: '🔥 Sage Green Bridesmaid Dresses', link: '#colors' },
  { title: '🔥 Dark Teal Dresses', link: '#colors' },
  { title: '🔥 Champagne Satin Dresses', link: '#colors' },
  { title: '🔥 Azazie Review', link: '#reviews' },
  { title: '🔥 Best Bridesmaid Websites', link: '#articles' }
];

export const colorTiles = [
  { name: 'Sage Green', hex: '#87a987', count: 23 },
  { name: 'Dusty Blue', hex: '#8ca6c2', count: 18 },
  { name: 'Champagne', hex: '#e8d8c8', count: 15 },
  { name: 'Terracotta', hex: '#c05c46', count: 21 },
  { name: 'Dark Teal', hex: '#005f60', count: 14 },
  { name: 'Emerald', hex: '#004b32', count: 19 },
  { name: 'Black', hex: '#111111', count: 25 },
  { name: 'Navy', hex: '#0f172a', count: 22 },
  { name: 'Blush Pink', hex: '#fbcfe8', count: 20 },
  { name: 'Burgundy', hex: '#6b1d2f', count: 17 }
];

export const bodyShapes = [
  { name: 'Hourglass', desc: 'Balanced bust & hips with a defined waist.', advice: 'Focus on wrap styles and cinched A-line silhouettes.' },
  { name: 'Pear', desc: 'Hips wider than shoulders/bust.', advice: 'Emphasize structural or detailed necklines to draw focus up.' },
  { name: 'Rectangle', desc: 'Bust, waist, and hips are of similar width.', advice: 'Look for side ruching and A-line skirts to create waist definition.' },
  { name: 'Athletic', desc: 'Broad shoulders and muscular build.', advice: 'Opt for deep V-necks or asymmetric necklines to break up shoulder width.' },
  { name: 'Apple', desc: 'Upper body wider with weight carried around midsection.', advice: 'Empire waistlines sit perfectly below the bust, creating length.' },
  { name: 'Petite', desc: 'Typically under 5\'4" height.', advice: 'Select high-waisted dresses and clean lines; avoid heavy layers.' },
  { name: 'Plus Size', desc: 'Fuller curves and silhouettes.', advice: 'Prioritize supportive built-in cups, wide straps, and wrap fronts.' },
  { name: 'Tall', desc: 'Typically over 5\'9" height.', advice: 'Standard sizes will require extra length panels; custom length is ideal.' }
];

export const brandReviews = [
  {
    id: 'azazie',
    name: 'Azazie',
    rating: '4.8/5',
    pros: 'Free custom sizing, massive color/style range, at-home try-on program.',
    cons: 'Custom orders are completely non-refundable; measurements must be precise.',
    desc: 'Azazie is the budget-friendly giant of bridal wear. Standard sizing is true to size, but their custom sizing is a savior for petite/tall bridesmaids.'
  },
  {
    id: 'jenny-yoo',
    name: 'Jenny Yoo',
    rating: '4.7/5',
    pros: 'Ultra-luxurious fabrics, high-end editorial drapes, gorgeous modern cuts.',
    cons: 'Runs small (usually requires ordering 2 sizes up), no seam allowance to let out.',
    desc: 'Jenny Yoo is ideal for brides looking for a high-fashion, high-quality aesthetic. Ensure everyone has professional measurements before ordering.'
  },
  {
    id: 'birdy-grey',
    name: 'Birdy Grey',
    rating: '4.5/5',
    pros: 'Flat $99 pricing, simple exchanges, very fast shipping on popular styles.',
    cons: 'No custom sizing options; fit consistency varies slightly between fabrics.',
    desc: 'The best option for strict budgets. Because standard sizes are long, hemming is almost universally required, so factor in tailor costs.'
  },
  {
    id: 'revelry',
    name: 'Revelry',
    rating: '4.6/5',
    pros: 'Exceptional size range (0-32), luxurious heavy satin, try-on boxes.',
    cons: 'Runs very small in non-stretch satin waistbands; size up if in-between.',
    desc: 'Revelry offers beautiful velvet, chiffon, and satin dresses. Use their try-on boxes to verify fit before committing to a final purchase.'
  },
  {
    id: 'park-fifth',
    name: 'Park & Fifth',
    rating: '4.7/5',
    pros: 'Minimalist re-wearable styles, highly adjustable smocked back panels.',
    cons: 'Limited color matching across completely different fabric collections.',
    desc: 'Park & Fifth is perfect for modern, clean bridesmaid styles. Smocked backing makes standard sizing highly flexible and forgiving.'
  },
  {
    id: 'davids-bridal',
    name: 'David\'s Bridal',
    rating: '4.2/5',
    pros: 'Huge off-the-rack availability, immediate ship, physical store network.',
    cons: 'Traditional boxy tailoring on budget cuts; fabric feel is less luxury.',
    desc: 'Convenient due to national store network, but fit quality is less premium compared to direct-to-consumer alternatives.'
  }
];

export const aiTools = [
  { id: 'find-size', title: '📏 Find My Size', desc: 'Scan your body in 30 seconds to decode your fit across 50+ brands.', btn: 'Run Free Scan' },
  { id: 'compare-charts', title: '📊 Compare Size Charts', desc: 'Overlay two brand charts side-by-side to find the most compatible cut.', btn: 'Compare Now' },
  { id: 'measure-convert', title: '📐 Measurement Converter', desc: 'Convert flat width garment specs directly into body circumferences.', btn: 'Convert Specs' },
  { id: 'body-shape', title: '⏳ Body Shape Finder', desc: 'Find your proportions profile and unlock custom silhouette guidelines.', btn: 'Analyze Shape' },
  { id: 'color-match', title: '🎨 Wedding Color Matcher', desc: 'Select your colors and preview matches across Azazie, Birdy Grey, and Revelry.', btn: 'Match Colors' },
  { id: 'suit-calc', title: '👔 Suit Size Calculator', desc: 'Calculate your jacket chest and sleeve lengths for custom suit tailoring.', btn: 'Calculate Size' }
];
