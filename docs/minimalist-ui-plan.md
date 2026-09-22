# PrintSync — Minimalist UI Plan

> **Status: PLAN ONLY. No code has been written, no branch created.**
> Base commit: `main` @ `ccbe44a3fd2b40994a824d2fd1167f7cb2ce91a1` (confirmed identical on the
> remote). `skeuo-redesign` is untouched and still pushed at `8188ec04` — 15 commits ahead.

---

## 1. Read this first

The previous direction (13 phases, `skeuo-redesign`) was **rejected**. The verdict, verbatim:

> "The only aspects that I enjoyed in this skeumorphic take are the buttons. It feels satisfying to
> click because of the 3D effect it gave. Everything else fell flat. Also, we just reskinned the
> website, and the structure and placement of the web application stayed almost identical, which I
> didn't like."

So this plan is built on two readings of that, and **both must be confirmed before Phase 1 starts**:

| # | Reading | What it commits us to |
|---|---|---|
| **Q1** | "Minimalist" means **structure and information architecture**, not a new skin. | Real changes to layout, chrome, page templates and navigation. This touches the component tree and can break working screens. |
| **Q2** | The **press feedback stays**. `.mat-press` / `.mat-sunk` (a control visibly sinks on `:active`) is interaction feedback, not decoration — it is invisible until used and costs nothing in layout. | Carry it into the minimalist direction deliberately. |

**Q1 is the one that matters.** The last run was scoped as "targeted surfaces first, dense tables
stay flat" — executed faithfully, that produced exactly the complaint. If the intent this time is a
surface-only restyle, this plan is the wrong shape and should be rewritten smaller. **Named
explicitly so it cannot be judged a failure for answering the wrong question again.**

---

## 2. What `main` actually looks like today (measured, not remembered)

Every number below was read from `main` at `ccbe44a3`.

### Chrome — 92px of it, in two stacked bars

| bar | height | contents |
|---|---|---|
| global header | 48px (`h-12`) | logo, business name, theme, notifications, profile |
| page toolbar | 44px (`h-11`) | sidebar toggle, current page label, connection status |

Two full-width glass bars (`glass-toolbar`) stacked above the content. The page toolbar carries one
real control and one label.

### Navigation

`AppSidebar.tsx` — a 196px collapsible aside, inset from the edges (`lg:my-3 lg:ml-3`), rounded
`1.35rem`, floating as its own glass card rather than being part of the frame. Collapse state
persists to `localStorage`. The active row is a **gradient pill with a blue drop-glow** and a
`layoutId` spring animation.

### Content — a card inside a page inside a card

```
body (radial gradient wash ×2)
  └ main
      └ div  p-3 lg:p-5 xl:p-6
          └ section  rounded-[1.5rem] bg-white/86 backdrop-blur-sm shadow-[var(--shadow-card)]
              └ {children}   ← every route, without exception
                  └ ...which then renders more cards
```

**Every one of the 9 protected routes is wrapped in the same rounded translucent panel.** That is
the structural tell in its purest form: one identical layout primitive repeated nine times, and
three levels of container before any real content.

### Decoration currently shipping

| thing | count |
|---|---|
| `glass-*` class usages | 11 |
| `backdrop-blur*` | 25 |
| `bg-gradient-to-*` | 10 |
| `shadow-[…]` literal (not a token) | 59 |
| `active:scale-[0.98]` | 4 |
| files importing `motion/react` | 8 |
| coloured radial washes (AppLayout) | 3 — cyan, purple, `#007aff` |
| coloured radial washes (body) | 2 |

### No scale anywhere

Padding values in use across `features/*/pages`: `p-1` (11), `p-2` (25), `p-3` (43), `p-4` (16),
`p-5` (8), `p-6` (2), plus `py-8`, `py-10`, `py-12`. **Seven different padding steps with no
underlying scale.** Same story for type: dashboard stat labels are
`text-[10px] font-bold uppercase tracking-[0.22em]` — a 10px label stretched to 0.22em tracking to
compensate for being too small to read.

### What is genuinely good and must not be lost

- `shared/components/feedback/` already exists: `EmptyState` (8 files), `LoadingState` (13),
  `ErrorState` (13), `InlineAlert` (5). **Empty/loading/error states are covered** — the most-cited
  structural "AI-generated" tell is not one of our problems.
- `--radius-card`, `--app-*` surface tokens, and the `@media print` block are load-bearing (§6).

### The test safety net is thin

11 test files. **Only 3 render a component** (`POSCheckoutModal`, `PrintableDocumentView`,
`useIsSyncing`); a 4th is `renderHook`. **None renders a page, a layout, or a route.** So a
restructure can pass CI completely and be visibly broken. This is the single biggest risk in the
plan and the reason §5 gates exist.

---

## 3. Principles

1. **Subtract, don't add.** Minimalism here is deletion: fewer containers, fewer colours, fewer
   shadows, fewer type sizes. A phase that adds more CSS than it removes has gone wrong.
2. **Structure before surface.** Chrome, navigation, page templates and spacing get decided first.
   Colour is last, because colour is the part that changes when structure is settled.
3. **The page is the surface.** Stop wrapping pages in cards. Separate with spacing and hairlines,
   not with nested containers.
4. **Borders over shadows, spacing over borders.** A 1px hairline and real whitespace carry
   hierarchy; elevation and blur are for the rare thing that is genuinely above the page (a
   dialog, a menu).
5. **One accent. Everything else neutral.** Colour marks meaning (a status, a live indicator), not
   decoration.
6. **Two scales, and only two.** A 4px spacing scale and a 6-step type scale. Anything outside them
   is a bug.

---

## 4. The target structure

### 4.1 Chrome — two bars become one

**Before:** 48px header + 44px page toolbar = **92px** of persistent chrome.
**After:** one **52px** header. Brand and page title left; theme / notifications / profile /
connection right. Page-specific actions move **into the page** where they act.

Saves 40px of vertical space on every screen, and removes the ambiguity of two bars that look alike
but hold different things.

### 4.2 Navigation — part of the frame, not a floating card

**Before:** 196px collapsible inset card, gradient active pill, spring animation.
**After:** a flush, full-height, hairline-separated rail (200px). Active state = weight + a left
indicator bar + a tinted row. No gradient, no glow, no spring.

*Open question (§8, D3):* the Boss previously asked for **no sidebar collapse control**. That
predates this direction and needs re-confirming — a minimalist frame either keeps the rail
permanently visible on desktop or removes the toggle entirely.

### 4.3 Content — remove the wrapper card

**Before:** `main > p-3 > section.rounded-[1.5rem].bg-white/86 > page > cards`
**After:** `main > p-6 > page`

The page itself becomes the surface. This is the change that most directly answers "the structure
and placement stayed almost identical" — it is the one thing visible on every single screen at once.

### 4.4 Three page templates, not nine bespoke pages

Today all 9 routes assemble their own shell around shared pieces (`TableContainer` in 10
components, `GlassCard` in 13). Three templates:

| template | routes | shape |
|---|---|---|
| **List** | Orders, Inventory, Customers, Users, Audit, POS history | title + action row → filter bar → full-width table → pagination footer. No card around it. |
| **Workspace** | POS | two-pane: catalog left, persistent cart rail right. The cart is *not* a floating card. |
| **Overview** | Dashboard, Analytics | metric strip (numbers, not cards) → sections separated by hairline rules in one readable column. |

Dashboard stat cards are the clearest case for change: four icon-in-a-gradient-chip cards become a
**metric strip** — number, label, tiny delta — separated by rules, with no boxes at all.

### 4.5 Scales

- **Spacing:** 4 · 8 · 12 · 16 · 24 · 32 · 48. Nothing else.
- **Type:** 12 / 13 / 14 / 16 / 20 / 24, plus one 32px display step for a metric. Weight does the
  work; tracking stays at or near normal. `tracking-[0.22em]` uppercase micro-labels are deleted —
  they are both unreadable and a well-known marker of generated UI.

### 4.6 Colour

- Delete: 3 AppLayout washes, 2 body washes, 10 gradients, 25 blurs, 11 glass utilities.
- Keep a 3-step neutral ladder (page / raised / chrome) + **one accent**.
- **The accent is undecided.** Today `--color-macos-blue` is `#555558`, a *grey* — chosen to
  de-Apple the palette, which means the app currently has no accent colour at all. A single real
  accent has to be picked (§8, D1).

---

## 5. Phase plan

One branch (`minimal-ui`), one commit per phase, **stop after each and wait for the word.** No phase
begins until the previous one is confirmed.

### Phase 0 — Brief confirmation & decision freeze
**No code.** Confirm Q1/Q2, and settle the decisions in §8 (accent, nav model, POS layout, sidebar
toggle, fate of `skeuo-redesign`). Everything downstream depends on these.
**Gate: the Boss's explicit go.**

### Phase 1 — Tokens & subtraction (CSS + tokens only, zero structural change)
Delete glass utilities, blurs, gradients, radial washes; install the spacing and type scales as
tokens. **Deliberately no layout change** — this isolates "did the app survive losing its
decoration" from "did the restructure work".
**Verification:** build clean; `tsc` clean; existing tests pass; print block byte-identical (§6);
Chromium probe that no element computes a `backdrop-filter` except the modal scrim.

### Phase 2 — Merge the chrome
One header. Global actions right, page title left, page actions move into the page.
**Verification:** measured header height; every route renders with no vertical overflow at 1280px
and at 1024px; notifications panel and profile menu still reachable and still positioned inside the
viewport (they are absolutely positioned off the header — this is where they break).

### Phase 3 — Remove the wrapper card
Delete the `rounded-[1.5rem]` section from `AppLayout`. The page becomes the surface.
**Verification:** all 9 routes render; container nesting depth measured before and after; no route
regresses into a scroll trap (`h-screen overflow-hidden` + a removed wrapper is a known way to
silently lose the scroll container).

### Phase 4 — Page templates
`<ListPage>`, `<WorkspacePage>`, `<OverviewPage>` shells; migrate the 6 list routes first (they are
the most uniform and therefore the safest), then Dashboard/Analytics.
**Verification:** each migrated route's controls re-checked by role — filters, pagination, row
actions, empty/loading/error states. **This is the phase most likely to break something real**, and
the one with the least test coverage (§2).

### Phase 5 — POS workspace
Two-pane layout; cart becomes a persistent right rail.
**Verification:** the money path. Cart totals, stepper wiring, checkout, `unknown` outcome retry,
receipt print. **No automated coverage exists for most of this** — it needs a real session and a
supervised pass.

### Phase 6 — Port the direction-independent accessibility work
Re-apply what `skeuo-redesign` proved and that is not style-specific (§7). Re-run the full contrast
audit across all routes **and inside dialogs** (the last audit never opened a modal, and the one
finding it predicted was in fact there).

### Phase 7 — Sweep & dead CSS
Remove orphaned utilities, collapse remaining literals to tokens, confirm Tailwind comments are not
re-emitting dead classes (it scans comment text as class candidates).
**Verification:** zero unused custom utilities in the built stylesheet; print block byte-identical.

---

## 6. Load-bearing constraints — must not break

These are properties of `main`'s existing code and hold regardless of direction.

- **The `@media print` block in `index.css` is guarded by `printStyles.test.ts`, which reads the
  file as text.** Do not edit its text. Adding a token inside it is also unsafe. Verify
  byte-identical after every phase: **3521 chars, sha256 `83e8f7fc…`** (hash the *blob* via
  `git show`, not the working-tree file — `core.autocrlf=true` makes those two differ by the line
  count).
- **`--color-macos-purple` stays a literal hex** and **`--radius-card` must not be deleted.** Both
  are consumed in the printed receipt's dependency chain.
- **`test/setup.ts`'s `matchMedia` stub must not be deleted** — `ThemeProvider` throws in jsdom
  without it.
- **Tailwind v4 scans comments as class candidates** and tree-shakes classes absent from source. A
  class written only in a test or a harness is never emitted; a comment naming a utility can
  re-emit a deleted one. Check built output for both the selector *and* the compiled value.
- **Lightning CSS rewrites values.** Grepping the bundle proves nothing — measure computed styles in
  a browser.
- **A filled control has two contrast jobs**: its label (AA 4.5:1) *and* its fill against the
  surface behind it (AA non-text 3:1). A theme-independent token needs no `dark:` partner; a
  theme-dependent one does.
- **`npm run build` currently fails in this sandbox** on a bulk-delete guard
  (`SAFE_DELETE_BULK_CONFIRM_REQUIRED`, 126 files). Not a code problem — build with
  `npx vite build --outDir <fresh dir>`.

---

## 7. What to salvage from `skeuo-redesign` (do not delete the branch)

The branch holds verified, measured accessibility work that is **independent of the look**:

- Contrast repairs: filled-control states (9 of 12 were failing), `red-700` for red text,
  `green-800` on green tints, selected-segment fills.
- Chart theming: Recharts ticks and legends follow the theme instead of hard-coded hex.
- `Tooltip` flip/clamp logic so it is not clipped off the top of the viewport.
- Reduced-motion block collapsing *delays*, not just durations.
- `aria-pressed` on segmented controls (they announced no state at all before).
- The `POSCart` stepper-wiring test — a swapped `+`/`−` type-checks, renders and screenshots fine.

**Caveat:** the *values* may not transfer if the palette is rebuilt, but the **rules and the
harnesses** absolutely do. Decide per item in Phase 6 rather than bulk-merging.

---

## 8. Decisions only the Boss can make

| # | Decision | Why it blocks |
|---|---|---|
| **D1** | The accent colour. The app currently has none — `macos-blue` is grey `#555558`. | Every colour decision downstream. |
| **D2** | Nav model: persistent rail (recommended) vs. top nav. | Determines the whole frame. |
| **D3** | Does the sidebar collapse control stay? (Earlier brief said remove it.) | Chrome and responsive behaviour. |
| **D4** | POS layout: right-rail cart (recommended) vs. current three-column. | Phase 5 depends on it. |
| **D5** | Fate of `skeuo-redesign` after the a11y work is ported — keep, archive, or delete. | Repo hygiene; nothing is lost either way while it stays pushed. |
| **D6** | How far the restructure goes: templates + chrome only, or including the POS money surface? | Risk. The POS is the highest-value and least-tested screen. |

---

## 9. Honest risks

1. **This can break a working ERP.** Unlike the last 13 phases (CSS tokens and shadows), this
   changes layout, chrome and the component tree across 9 routes.
2. **CI will not catch it.** 11 test files, 3 rendering a component, **none rendering a page.** A
   green build is not evidence. Every phase needs the Boss's eyes on `npm run dev`, plus the
   measured checks listed per phase.
3. **Some screens cannot be verified from here.** POS, checkout and most dialogs need a real
   authenticated session; credentials were rotated 2026-09-17 and the login route allows 10
   attempts / 15 min / IP. Automated checks there are narrower than on other screens.
4. **The receipt path is CSS-only and print-only**, so it is insulated from structural change — but
   `#receipt-content` sits inside the `Modal` ancestor chain, which Phase 4/5 touch. The
   byte-identical print check is the guard.
5. **Removing the sidebar toggle changes behaviour for existing users** whose collapsed state is
   already in `localStorage`.

**Not started, nothing changed.** `main` is at `ccbe44a3`, working tree clean apart from the
untracked research doc. Awaiting confirmation of Q1/Q2 and the §8 decisions.
