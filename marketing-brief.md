# Styla — Marketing Brief & Context Primer

> Start-here doc for a marketing conversation. Read this first, then skim `VISION.md`,
> `index.html`, `bridesmaid.html`, and `brands.html` for tone and current copy.
> Last updated 2026-07-25.

## What Styla is (one line)

Styla finds the clothing brands that actually fit your body — with your exact size in each —
from a 2-minute questionnaire. No tape measure, no photos, no 3D scan.

The core insight: **a "medium" isn't a medium.** Every brand sizes differently, so people are a
different size in every store. Styla builds a fit profile once and maps it to each brand's real
size chart.

## Who we're for (ICPs)

**Consumer — primary (women-first):** People whose bodies don't match the standard size grid —
curvy/petite/between-sizes women and hard-to-fit men (athletic, tall). Underneath: the serial
online returner who orders two sizes of everything.
- What they say: "I'm a 6 in one brand and a 10 in the next." "It looked fine online, then showed
  up totally different." "Everything needs to be taken in."

**Gifting / shop-for-others:** Gift-givers, couples, and personal stylists buying clothes for
someone else and guessing their size. (Powered by the size-sharing feature.)

**Bridal (wedding parties):** A bride or maid-of-honor sizing a whole party of different bodies
into one dress by a deadline. Group product, $29.99 flat.

**B2B (fashion brands):** DTC/Shopify brands bleeding margin to size-related returns. Styla offers
an on-site size recommender + real body data + an embeddable widget. CTA = book a demo (Calendly).

## Proof points / stats (with sources — safe to use in copy)

- 87% of shoppers who returned an item said it didn't fit. — Journal of Business Economics, 2021 (n=8,393)
- The same 42″ bust is labelled 4 different sizes across six brands. — Styla, from the brands' own published charts
- A single "size 14" top varies by up to 5 inches between brands. — Styla, from the brands' own published charts
- WITHDRAWN — do not use: "65% (Sizer 2024)", "70% of returns (McKinsey)", "12cm medium spread". See marketing/ad-copy-playbook.md §0.
- Clothing is the #1 most-returned category; 65% of holiday returns are clothing. — Statista / Chain Store Age
- ~60% of apparel shoppers bracket-buy (order multiple sizes to return extras).
- Bridesmaid dresses run 1–2 sizes small; everyone lands on a different size. — Azazie / StyleCaster

## Positioning & voice

- **Say the pain back to them.** Lead with the shopper's exact experience ("size 6 here, size 10
  there"), then the reframe ("You're not the problem — the sizing is").
- Tone: warm, confident, plain-spoken. Editorial serif headlines (EB Garamond), clean sans body.
  Dark theme, pink accent (#ff2a75). Not clinical, not hypey.
- Avoid: "digital twin," "3D scan," "measure yourself" — that's the retired scan-era language.

## What's live / built (so marketing promises match reality)

- **Homepage** (`index.html`): women-first hero, how-it-works, gifting section, bridal cross-sell.
- **Questionnaire** (`start.html`): 2-min fit questionnaire → real brand matches.
- **Dashboard** (`dashboard.html`): matches, editable fit profile, free bookmarklet, share/gift.
- **Bridal** (`bridesmaid.html`): wedding-party funnel, $29.99 group unlock.
- **Sharing** (`share.html`): share your size / shop for others (gifting, stylists, couples).
- **Brands** (`brands.html`): B2B page, book-a-demo (Calendly), embeddable widget in pilot.
- **Widget** (`widget.js` + `widget.html`): embeddable "Find your size" for brand product pages.
- **Tools**: AI Size Chart Maker + MOQ Price Calculator (`/tools/`). Blog at `/blogs`.

## Monetization

- Consumer: free to see top matches; **$9.99 one-time** unlocks the full ranked brand list.
- Bridal: **$29.99 one-time**, coordinator pays once for the whole party.
- Bookmarklet is **free** (adoption + body-data flywheel).
- B2B: widget + analytics subscriptions (demo-led). Future: affiliate on item search, premium scan.

## Channels & assets already in place

- Socials: Instagram, TikTok, X — all **@stylaca**.
- Blog: `/blogs` (separate journal app).
- Email: SendGrid (transactional templates written; see `email-templates.md`).
- Domain: styla.ca. SEO: `robots.txt` + `sitemap.xml` live; submit to Google Search Console.

## Good first marketing tasks to consider

- A launch/awareness campaign plan for the consumer (women-first) funnel.
- Organic social content pillars for @stylaca (the "different size in every brand" hook is strong).
- A gifting push timed to a holiday window (clothing = #1 returned gift).
- Bridal outreach (wedding planners, bridal salons) for the group product.
- Paid social creative concepts around the mirror-back pain hooks.
