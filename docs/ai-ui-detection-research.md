# How to tell a UI design was AI-generated

Research brief compiled 2026-09-19. Sources at the bottom.

## The mechanism (read this first)

An LLM asked to build a page with no art direction does not invent. It returns to the
centre of its training distribution and emits the most statistically common version of
every decision. Different prompts, different models, different days converge on the same
look because they are all averaging the same web.

That convergence is what makes detection possible — and it is why **no single tell is
proof**. Detection is clustering, not any one sign:

| Tells triggered | Reading |
|---|---|
| 0–1 | A deliberate choice |
| 2–3 | AI-assisted work, lightly edited |
| 4+ | The centroid look — generated with no art direction on top |

The most-cited data point: Adrian Krebs scored **1,590 Show HN landing pages** against 16
patterns using Playwright + deterministic CSS/DOM checks (no LLM judge). Result:
**22% heavy** (4+ patterns), **32% mild** (2–3), **46% clean** (0–1). Most common single
tell was permanent dark theme at 34%, then gradient backgrounds 27%, then icon-card grids
22%. He reports **5–10% false positives** on manual QA.

The purple gradient traces to a specific origin: Tailwind shipped `indigo-500` as its
default in 2019, it became the most common colour in the training corpus, and models now
reach for it first. Adam Wathan (Tailwind's creator) publicly joked about apologising for
it. It is a feedback loop, not a trend.

## 1. Colour

- **VibeCode Purple** — indigo/violet filled CTAs and links. Weight 8, tied for the
  loudest tell. Roughly `#7c3aed` → `#6366f1`.
- **Cream / beige default page background** — weight 7. The *new* purple as of 2026.08;
  the tell moved when everyone started avoiding purple.
- **Low-contrast grey body text** — weight 7. Fails WCAG AA. `#666` on white is 2.54:1
  against a 4.5:1 requirement.
- **Gradient hero text** (`background-clip: text`) — weight 6.
- **Gradient backgrounds** on 5+ elements — weight 4.
- **Aurora / mesh gradient blobs** — weight 5. Newer tell, added 2026.07.
- **Coloured glows** — saturated `box-shadow` on buttons and cards — weight 4.
- **Perma dark mode** with muted grey body text and all-caps labels — weight 4.
- **Grey text on a coloured background** — weight 4.

## 2. Type

- **Inter / Geist / Space Grotesk as the default stack** — weight 8, tied loudest.
  Especially Inter used as a *display* face at 64–90px; it was tuned for body legibility.
- **Templated display fonts** — Space Grotesk, Instrument Serif, Geist, Syne, Fraunces.
- **Hero font mix** — one hero word set apart with a second face, an italic, or colour.
- **Crushed letter-spacing on display type** — weight 5.
- **Oversized hero H1** — a whole sentence set at display size — weight 4.
- **Flat type hierarchy** — sizes too close together, everything competes equally — weight 3.
- **All-caps section labels** — weight 3.
- **Arbitrary px values** (`text-[90px]`) instead of a type scale.

## 3. Layout and structure

- **Coloured stripe on a card's top or left edge** — weight 6. A designer Krebs quoted
  called it "almost as reliable a sign of AI-generated design as em-dashes are for text."
  The single most specific tell on the list.
- **Eyebrow pill badge floating above the H1** ("Now in beta", "New") — weight 5.
- **Identical feature cards with an icon on top** — 22% of Show HN pages. Three equal
  cards is the canonical version; real content is lopsided because real features are not
  equally important.
- **Centered hero in a generic sans** — weight 4.
- **Numbered "1 · 2 · 3" step sequences** — weight 3.
- **Stat banner rows** ("10K+ users · 99.9% uptime · 4.9★") — weight 3.
- **FAQ accordion in the lower half** — weight 2.
- **Bento grid** — weight 4. Newer tell.
- **Cards nested inside cards** — weight 4. Newer tell.
- **Uniform radius, shadow and padding everywhere** — nothing flat, no hard edges, no
  elevation hierarchy. Sameness is the signal, not any one value.

## 4. Components and imagery

- **Emoji as iconography** — 🚀 launch, ⚡ fast, 🔒 secure. Renders differently on every
  OS and ignores brand colour. No quality design system ships emoji as icons.
- **shadcn/ui defaults unmodified** — the `--radius: 0.5rem` token block is recognisable
  in two seconds. shadcn is explicitly designed to be copy-pasted by agents, so every
  unconstrained generation converges on it.
- **Glassmorphism** — `backdrop-filter: blur` on translucent floating panels — weight 4.
- **Gradient-letter avatars** in testimonials — weight 5.
- **AI sparkle badges** (✨) — weight 3.
- **Stock or generated hero image with a dark scrim.** The scrim is the tell more than
  the photo: ask whether the image could be swapped for any other in its category with
  zero loss.
- **Hardcoded five-star testimonials** with stock-avatar headshots and no attribution.

## 5. Copy

- **The name-swap test.** Replace your company name with a competitor's in the homepage
  copy and read it aloud. If it still makes complete sense, the copy is describing a
  category, not a company.
- **Buzzword density** — seamless, innovative, cutting-edge, industry-leading, leverage
  (as a verb), synergy, end-to-end, holistic, passionate, committed to excellence, delve.
- **Filler openers** — "In today's rapidly evolving landscape…".
- **Em-dash overload and the "not just X, it's Y" antithesis.**
- **Confident but weightless** — "Transform your workflow", "Built for modern teams",
  "Build faster. Ship smarter."
- **No concrete specifics.** "Significantly improved efficiency" vs naming the client,
  the city, the before state, the after state, and the mechanism. AI cannot generate
  specifics because it has no experiences.

## 6. The finish-line gaps — the strongest evidence, hardest to fake

These are not aesthetic. They are the tells that separate "generated" from "finished",
and they cost more to fake than to leave at default.

- **Missing states.** No empty state, no loading/skeleton state, no error state, no
  permission-denied state. Each missing state is a moment the interface abandons the user.
- **No favicon, default meta tags, missing alt text.**
- **Placeholder content that shipped** — John Doe / Jane Doe, Lorem ipsum, TODO/FIXME,
  `console.log` in components.
- **Dead links and nav items that go nowhere.**
- **Accessibility gaps** — no visible focus ring, controls unreachable by keyboard,
  `<a>` with `onClick` but no `href`, `<svg>` with no `aria-hidden`, `<img>` with no
  `alt`, skipped heading levels, touch targets under 44px, `z-index: 9999`.
- **No spacing scale.** A real design system uses 4/8/16/24/32. Arbitrary `23px` and
  `37px` means output assembled without tokens.
- **A contact form where a booking system should be** — the AI cannot wire up scheduling,
  deposits and reminders, so it gives you a form and moves on.

## How to weigh it — and where this breaks

Be careful. These tells are largely *2020s startup web design*, not proof of AI. The
pre-LLM equivalent was every site looking like Bootstrap. Honest caveats:

- **False positives are real.** Krebs dropped two of his original patterns after
  validating against hand-labelled sites: `icon_card_grid` fired *more often on clean
  sites than on slop*, and `all_caps_headings` fired *only* on clean sites. His detector
  still self-reports 5–10% false positives.
- **The accessibility evidence is mixed.** One ASSETS '25 study found 308 accessibility
  errors across six AI-generated sites (52.9% cognitive, 47.1% WCAG 2.2). But another
  study of 90 AI-generated UIs found violations were *rare and low severity* (73 of 90
  had zero), and — counter-intuitively — more detailed accessibility prompting did not
  reliably reduce violations. Treat "AI UI is inaccessible" as plausible, not settled.
- **A skilled human using Cursor or Claude produces work with none of these tells**,
  because they brought taste and a brand to the prompt. The fingerprint is the look of
  generation left *unedited*.

## Tools that score this automatically

| Tool | What it does |
|---|---|
| `slopcop.adriankrebs.ch` | The original. 14 deterministic patterns, 0–100 score, tiers 5+ High / 3–4 Medium / 1–2 Low / 0 None. Source: `github.com/AdrianKrebs/design-slop-cop`. |
| `npx slop-detect <url>` | 27 weighted design tells + 9 copy tells in real headless Chromium. Presets: `strict` (weight ≥5 only, good CI gate), `minimal` (the three dead-giveaways). Has a GitHub Action and an MCP server. |
| `uxskill` | 35 regex fingerprints grouped typography/color/layout/content/motion/a11y/quality, each with a documented fix. Exits non-zero on high-severity matches. |

All three deliberately use deterministic checks over computed styles rather than an LLM
judging screenshots — letting a model grade AI slop by eye would introduce the exact bias
being measured.

## Sources

- Adrian Krebs, *Scoring Show HN submissions for AI design patterns* — adriankrebs.ch/blog/design-slop (primary research, 1,590 pages)
- `github.com/AdrianKrebs/design-slop-cop` — the 14-pattern rubric and scoring
- `slop-detect.com/docs` and `/api/patterns` — 27-pattern weighted catalogue, definitions 2026.09
- Developers Digest, *AI Design Slop: 16 Patterns That Out Your App as Vibe-Coded*
- uxskill, *How to tell if a website was AI generated* (9 visible signs) and *The 35 AI design fingerprints*
- 925Studios, *AI Slop Fonts and Gradients: The Tells That Give Away AI Design*
- OhhWells, *Vibe-Coded Website Examples (2026): the 7 tells*
- GrowthGuys, *How to Spot an AI Slop Website in 60 Seconds* (10-point audit)
- SmoothUI, *AI Design Slop: Why AI-Generated UI Looks Generic* (root cause: no taste, no loop)
- ASSETS '25, *Can Generative AI Create Accessible Websites?* (Panchanadikar, Bhosekar, Dixon)
- ACM DL, *Good Accessibility, Handcuffed Creativity: AI-Generated UIs Between Accessibility Guidelines and Practitioners' Expectations*
- ACM DL, *When LLM-Generated Code Perpetuates User Interface Accessibility Barriers, How Can We Break the Cycle?*
- Spin by Fryga, *Why AI UI Looks Good But Feels Wrong* (missing states, flat hierarchy)
