# CLIQ — Brand Kit

Reference sheet for building the pitch deck, slides, or any other presentation
material. Pull colors, type, copy, and logo files straight from here — nothing
in this document should need to be reinvented per-deck.

## 1. Brand in one paragraph

CLIQ is a self-custodial USD₮ payment terminal for small and medium
businesses. The visual identity is built around a single idea: **a signed
receipt is the product.** Every color, shape, and typographic choice traces
back to the physical object of a paper receipt — stamped, dated, itemized,
torn off a pad — reinterpreted as something cryptographically unforgeable.
Warm, paper-like, tactile. Not another cold fintech-blue dashboard.

## 2. Name and tagline

- **Name:** CLIQ (one word, all caps — `CLIQ`, never "Cliq" or "cliq").
- **Positioning line:** *A payment terminal for merchants, not for the cloud.*
- **Descriptive line (for slide subtitles / meta descriptions):**
  *Self-custodial USD₮ payments, a tamper-proof sales ledger, and offline-first
  sync — for any small business, not just one kind of shop.*
- **Short pitch line (for a title slide):**
  *Your sales notebook, now in digital dollars.*

Avoid: "app," "platform," "solution" as the primary descriptor on a title
slide — lead with "payment terminal" or "ledger," which are concrete and
match the physical metaphor.

## 3. Color palette

| Token | Hex | Role |
|---|---|---|
| `sand` | `#E4D5B7` | Primary light background; primary dark-mode text/button color |
| `tan` | `#C9B79C` | Card / surface background (light mode) |
| `clay` | `#A78A7F` | Accent only — dashed rules, borders, icon strokes. **Never use as body text color on either sand or ink** (contrast ratio ≈2.2:1, fails WCAG AA) |
| `umber` | `#6E5B5B` | Secondary/muted text on light backgrounds (4.4:1 on sand — fine at 15px+ semibold, avoid for small body copy); surface background in dark mode |
| `ink` | `#3F3A3A` | Primary text on light backgrounds; primary dark-mode background |

Verified contrast pairs (WCAG relative luminance):

| Pair | Ratio | Use |
|---|---|---|
| `ink` on `sand` | 7.72:1 | Body text, light mode |
| `sand` on `ink` | 7.72:1 | Body text, dark mode / dark slide backgrounds |
| `ink` on `tan` | 5.72:1 | Text on light-mode cards |
| `tan` on `ink` | 5.72:1 | Muted text on dark-mode surfaces |

**Theme logic:** light and dark mode are not two different palettes — they are
the same five tokens with roles swapped (`sand`↔`ink` as bg/text,
`tan`↔`umber` as surface). If you build a dark slide deck, invert roles this
way rather than inventing new colors.

**Do not** introduce a sixth color (no blue "trust" accent, no green
"success" accent, no red "error" accent) unless functionally required — the
five-color discipline is itself part of the identity.

## 4. Typography

| Role | Typeface | Google Fonts embed | Notes |
|---|---|---|---|
| Display / headlines | **Fraunces** | `family=Fraunces:ital,opsz,wght@0,9..144,600..900;1,9..144,500..600` | Warm serif, wide optical-size range. Use bold-to-black weights (700–900) at large sizes only; italic at 500–600 for pull-quotes. |
| Body copy | **Karla** | `family=Karla:wght@400;500;600;700` | Humanist sans, keep body text near 65 characters per line. |
| Numbers / receipts / code | **IBM Plex Mono** | `family=IBM+Plex+Mono:wght@400;500;600` | Use for currency amounts, receipt IDs, transaction hashes — anything tabular. Pair with `font-variant-numeric: tabular-nums` when columns of numbers need to align. |

Fallback stacks (for environments without Google Fonts access):
`Fraunces, "Iowan Old Style", "Palatino Linotype", serif` /
`Karla, "Helvetica Neue", Arial, sans-serif` /
`"IBM Plex Mono", "SF Mono", Consolas, monospace`.

For a slide deck built outside a browser (Keynote/PowerPoint/Figma), use
Fraunces for titles, Karla for body, and any monospace face (SF Mono, Consolas,
JetBrains Mono) for figures if IBM Plex Mono isn't installed.

## 5. Logo

Files live in [`public/assets/`](public/assets/):

| File | Use |
|---|---|
| `logo-mark.svg` | Icon-only mark, sand background. Default choice — favicons, small placements, light slide backgrounds. |
| `logo-mark-dark.svg` | Icon-only mark, ink background. Use on dark slide backgrounds. |
| `logo-lockup.svg` | Mark + "CLIQ" wordmark, horizontal. Use for title slides, README header, anywhere the full name needs to appear once at the top. |

**What the mark is:** a circular seal — echoing a stamped receipt — containing
a ₮ glyph (a T with two horizontal strokes, the conventional USD₮ symbol)
built from simple geometric bars, with a dashed inner ring that repeats the
receipt's perforated-edge motif used throughout the product. It is an
original mark; it does not reproduce Tether's corporate logo.

**Clear space:** keep empty space around the mark equal to at least the width
of one of the ₮ glyph's horizontal bars. Don't crowd it against text or page
edges.

**Do:**
- Place the mark on `sand` or `ink` backgrounds only (the two variants provided).
- Scale proportionally; the mark is a perfect circle and must stay one.

**Don't:**
- Recolor the mark outside the five palette tokens.
- Place `logo-mark.svg` (light) on a dark background or vice versa — contrast breaks.
- Add drop shadows, gradients, or bevels — the flat, stamped look is the point.

## 6. Iconography and imagery motif

The product has one running visual metaphor: **the signed paper receipt.**
Every supporting graphic should reinforce it, not introduce a competing
metaphor (no generic "blockchain chain links," no abstract network-node
graphics, no stock photos of people tapping a card reader).

Recurring devices used across the landing page and logo, safe to reuse in a
deck:
- A torn/perforated bottom edge (zigzag), as if ripped from a receipt pad.
- A dashed rule (`clay`, 1–1.5px, dash pattern ~3px on / 5.5px off) standing
  in for a stitched or perforated line.
- A small rotated "stamp" label (e.g. "FIRMADO" / "SIGNED"), slightly
  rotated, as a corner accent on a card or screenshot.
- Tabular monospace figures for any dollar amount or ID, always right-aligned
  in a "line item" layout (label left, amount right).
- Numbered steps as plain two-digit tabular numerals (`01`, `02`, ...), not
  circular badges or icon bullets — used only when the content is a genuine
  ordered sequence (e.g. the four-step payment flow), never as decoration.

## 7. Voice and tone

- **Audience:** a small or medium business owner — not a developer, not a
  crypto-native user. Copy must read naturally to someone who has never heard
  "DHT," "Hyperswarm," or "Ed25519."
- **Register:** plain, warm, concrete. Prefer a specific noun over an
  abstraction ("your sales notebook" beats "your business data").
- **Never expose infrastructure names in user-facing copy.** Internally the
  product uses WDK, Hyperswarm, and QVAC; externally it "lets you receive
  digital dollars," "keeps working without internet," and "answers questions
  about your own sales." Save the technology names for the architecture
  document and the technical judges' Q&A, not the pitch itself.
- **No false claims.** Every capability described in customer-facing copy
  must correspond to something the product actually does today — see
  `README.md` for what's implemented vs. still to validate.
- **Language:** the CLI's own runtime output (`src/commands/*.js`) stays in
  unaccented, neutral Spanish — no regional slang, no `vos` conjugation — since
  that's who the product actually talks to at the counter. Repository
  documentation (`README.md`, `TESTING.md`, `pear-cli/README.md`) is in
  English, same as this brand kit, the architecture doc, and the deck, for an
  international/technical audience. The landing page (`public/index.html`) is
  bilingual (Spanish/English) with a small toggle in the header — write new
  landing copy in both languages, keeping the same unaccented, neutral
  register on the Spanish side. Keep that split when producing new material
  rather than mixing languages within one document.

## 8. Ready-to-use lines for slides

- *"Cobrar es la parte fácil. Lo demás es lo que cansa."* (Spanish, from the
  landing page — "Getting paid is the easy part. Everything else is what
  wears you down.")
- *"Your money, your data, your business. Nobody else holds the key."*
  (trust statement, works as a section header or closing slide)
- *"Built for the counter, not the cloud."* (closing tagline)
- Four-step flow, if a deck needs the product loop in one slide: **Create the
  charge → Customer pays → A signed receipt is created → It syncs on its
  own.**
