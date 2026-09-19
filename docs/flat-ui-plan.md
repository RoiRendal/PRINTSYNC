# Plan — remove glass/translucency and gradients (flat surfaces)

**Date:** 2026-09-19
**Base:** `main` @ `ccbe44a3` (local `main` is 5 commits ahead of `origin/main` @ `8a8defc`; cut from local)
**Scope:** visual surface only. **No layout, placement, or information-architecture changes.**

---

## 0. Read this first — what this plan is not

This is a **surface-only pass**. Every page keeps its current structure, component
placement, navigation and content order. Only three things change:

1. translucent fills → solid fills
2. `backdrop-filter` blur → none
3. gradients → single solid colours

If you also want structure/placement changed, say so **before** Phase 1 — that is a
different job and it would be cheaper to do both in one pass than to redo this one.

### Decisions locked in

| Question | Decision |
| --- | --- |
| How far to strip translucency | **Everything**, including hover/state tints (~191 values) |
| Modal backdrop / mobile scrim | **Keep the dim, drop the blur** — the one sanctioned exception |
| Gradients | **All flat** — both page-background radials *and* the 8 decorative ones |

---

## 1. Measured inventory (audit of `frontend/src`, taken 2026-09-19)

| Pattern | Occurrences | Files |
| --- | --- | --- |
| `backdrop-blur` (Tailwind utility) | 25 | 21 |
| `bg-gradient` / `gradient-to-` | 10 | 9 |
| `bg-[radial-gradient(...)]` arbitrary-value washes | 3 | 3 |
| `bg-white/NN` translucent fills | 153 | 40 (with `border-*/NN`) |
| `bg-black/NN` translucent fills | 35 | — |
| `border-white/NN` translucent borders | ~135 | — |
| `border-black/NN` | ~50 | — |
| hover/state tint variants | 124 | — |
| base (non-hover) translucent fills | 67 | — |

**Where glass actually lives — it is a small, well-contained system:**

`frontend/src/index.css` defines three utilities that carry all of it:

- `.glass-panel` (L224) — `--glass-bg` + `saturate(180%) blur(24px)`
- `.glass-toolbar` (L233) — `color-mix(...)` + `saturate(180%) blur(20px)`
- `.glass-modal` (L242) — `--glass-bg-strong` + `saturate(180%) blur(40px)`

…plus 10 `--glass-*` custom properties (L39–45 light, L57–60 dark) and two radial
gradients painted on `body` (L80–83 light, L89–93 dark).

Call sites of those three utilities — **only 11 in the whole app**:

| File | What |
| --- | --- |
| `shared/components/ui/Card.tsx:16` | `variant: 'glass'` → `glass-panel` |
| `shared/components/ui/Modal.tsx:55` | dialog panel → `glass-modal` |
| `shared/components/ui/Modal.tsx:67` | dialog header → `glass-toolbar` |
| `shared/components/ui/Table.tsx:31` | `<thead>` → `glass-toolbar` |
| `app/layout/AppSidebar.tsx:19` | sidebar → `glass-panel` |
| `app/layout/AppLayout.tsx:119, 240` | top toolbar, sub-toolbar |
| `app/layout/AppLayout.tsx:214` | user menu popover |
| `app/components/NotificationPanel.tsx:49` | notification popover |
| `features/inventory/components/InventoryTable.tsx:115` | table footer |
| `features/orders/components/orders/OrdersTable.tsx:231` | table footer |

`GlassCard` / `variant="glass"` are referenced **58 times** across ~15 feature files, all
through `Card.tsx` — so fixing `Card.tsx` fixes most of the app at once.

### The single most useful number in this audit

Flattening today's glass fills over the page colour shows what they were actually doing:

| Today | Flattens to | Contrast vs page `#f5f5f7` |
| --- | --- | --- |
| `white/34` | `#f8f8fa` | 1.03:1 |
| `white/45` | `#fafafb` | 1.04:1 |
| `white/72` | `#fcfcfd` | 1.06:1 |
| `white/82` | `#fdfdfe` | 1.07:1 |
| `white/94` | `#fefeff` | 1.08:1 |
| solid white | `#ffffff` | 1.09:1 |

**The entire glass range spans 1.03:1 → 1.09:1.** The fills were never separating
panels from the page — the separation came almost entirely from `--glass-border` and
`--shadow-glass`. Two consequences drive this whole plan:

1. **Flattening is low-risk.** Solid `#ffffff` is nearly identical to today's panels.
2. **Borders now carry all the separation.** If borders are flattened to a faint value,
   cards will vanish into the page. Border colour is the load-bearing decision here,
   not fill.

### Correction found in Phase 1 — the grep undercounted, and the visible gradient was not where the audit said

Two things the source grep could not see, both found by measuring the running app:

**The background gradient is an arbitrary-value class, not a gradient utility.**
`AppLayout.tsx`, `LoginPage.tsx` and `ErrorBoundary.tsx` each paint a full-viewport
decorative wash with `bg-[radial-gradient(...)]` — cyan/purple over the whole app, cyan/purple
on login, red on the error screen. A grep for `bg-gradient` / `gradient-to-` finds none of
them. **These, not the `body` washes, are the gradient you can actually see**, and they are
now gone (commit `2be5289`). The lesson for the remaining phases: **grep finds call sites;
only a runtime census finds paints.** The harness in
`~/.workbuddy-ai/scratch/flatui-baseline.mjs` counts paints.

**The `body` washes were already invisible.** An opaque shell wrapper
(`bg-[var(--app-surface)]`, full viewport) covers them, so deleting them changed **36 pixels**
across nine routes. Deleting the three overlays instead changed **28–35% of every viewport**
(88% on login). Both were worth doing; only one of them was the thing you asked about.

**Runtime census, 9 routes × 2 themes, real session — the number Phase 6 drives to zero:**

| Signal | Before | After Phase 1 | After Phase 2 | After Phase 3 | After Phase 4 | After Phase 5 | After Phase 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gradient paints | 316 | **280** | **0** | 0 | 0 | 0 | 0 |
| `backdrop-filter` paints | 656 | 656 | **0** | 0 | 0 | 0 | 0 |
| translucent fills | 1163 | 1163 | 1163 | **599** | **347** | **0** | 0 |
| translucent borders | 1344 | 1344 | 1344 | **0** | 0 | 0 | 0 |
| `glass-*` classes | 170 | 170 | 170 | 170 | 170 | 170 | **0** |

All five census signals now zero. The flat-ui direction is complete.

**Second blind spot, found in Phase 2 — glass also hides in JS style objects.**
`analytics-types.ts` set `backdropFilter: 'blur(20px)'` and a translucent tooltip fill in a plain
JS object, not in a class. A class-based grep cannot see it and a Tailwind sweep cannot touch it.
Eight paints survived the whole blur sweep that way. **For the remaining phases, sweep for glass in
three places, not one: class names, JS/`style` objects, and `index.css`.**

The 280 remaining are the decorative ones — icon tiles, progress bars, the phase tracker —
which is Phase 2's job, not Phase 1's.

---

## 2. The flat token ladder

Add to `index.css`, alongside (not replacing) the `--glass-*` tokens until Phase 6.
All values below are measured, not guessed.

### Light (`:root`)

| Token | Value | Measured |
| --- | --- | --- |
| `--app-surface` (page) | `#f5f5f7` | unchanged |
| `--app-surface-raised` | `#ffffff` | 1.09:1 vs page |
| `--app-surface-sub` | `#ececef` | 1.18:1 vs raised — toolbars, table headers, segmented tracks |
| `--app-surface-sunken` | `#e3e3e8` | 1.28:1 vs raised — inset wells |
| `--app-state-hover` | `#ececef` | 1.18:1 vs raised (today's `hover:bg-black/5` = 1.12:1, so this stays visible) |
| `--app-border-hairline` | `#d5d5da` | 1.46:1 vs raised — internal dividers |
| `--app-border-control` | `#8e8e93` | **3.26:1** vs raised — input/button edges (meets WCAG 1.4.11 3:1) |
| `--app-scrim` | `rgb(0 0 0 / 0.45)` | **the one exception** — modal/mobile dim, blur removed |

Text is unaffected: `#1d1d1f` on `#ececef` = 14.27:1, muted `#555558` on `#ececef` = 6.30:1.

### Dark (`.dark`)

| Token | Value | Measured |
| --- | --- | --- |
| `--app-surface` (page) | `#1c1c1e` | unchanged |
| `--app-surface-raised` | `#2c2c2e` | 1.22:1 vs page |
| `--app-surface-sub` | `#3a3a3c` | 1.50:1 vs page |
| `--app-surface-sunken` | `#48484a` | 1.86:1 vs page |
| `--app-state-hover` | `#3a3a3c` | 1.23:1 vs raised (today's `hover:bg-white/6` = 1.21:1) |
| `--app-border-hairline` | `#48484a` | 1.53:1 vs raised |
| `--app-border-control` | `#8e8e93` | **4.27:1** vs raised |

### ⚠ Muted text trap in dark mode (must be handled)

Today's muted token `#98989d` **fails AA (4.5:1) on the two new upper surfaces**:

| Text | on `#2c2c2e` | on `#3a3a3c` | on `#48484a` |
| --- | --- | --- | --- |
| `#98989d` | 4.85 ✅ | **3.95 ❌** | **3.18 ❌** |
| `#aeaeb2` | 6.30 ✅ | 5.13 ✅ | **4.13 ❌** |
| `#c7c7cc` | 8.28 ✅ | 6.74 ✅ | 5.42 ✅ |

**Rule to apply:** muted text may sit on *page* and *raised* only. Where muted text sits
on a `-sub` surface (table headers, toolbars — several do), use `#aeaeb2`. On `-sunken`,
use `#c7c7cc`. Table headers are 9–10px uppercase today, so this is not cosmetic.

### Gradient replacements (all 10)

| Today | Flat replacement |
| --- | --- |
| `body` radial gradients ×2 (light + dark) | delete; `background: var(--app-surface)` |
| Icon tiles `from-macos-blue/18 to-white/40` & `/16 to-white/45` (5 files) | `--app-surface-sub` |
| Progress bar / phase tracker `from-macos-blue to-macos-cyan` | `#555558` (`macos-blue`) solid |
| Avatar `from-macos-blue to-macos-cyan` | `#555558` solid |
| Sidebar active-item gradient overlay | `#555558` solid |

Note: `--color-macos-blue` is `#555558`, a grey — these "blue" gradients are grey ramps,
so flattening them is nearly invisible.

---

## 3. Phases

Work on a branch cut from `main`: `git branch -f flat-ui ccbe44a3` (flat name, no slash —
slashed names have caused trouble here). Each phase ends with a green type-check, lint
and test run, and a commit.

### Phase 1 — Tokens + baseline — **DONE, commit `2be5289`**

Order was reversed from the original plan and that mattered: **the baseline was captured
first, on pristine code.** Tailwind emits only the classes it finds in the source, so once a
class is deleted its old paint stops existing and a later "before" would have been measured on
already-changed code — a false pass.

1. ✅ Captured the before set: 9 routes × 2 themes + login, plus the glass census above.
2. ✅ Added the ladder tokens to `:root` and `.dark`. Verified **inert** — the census after
   this step was bit-identical to the baseline on every signal.
3. ✅ Removed the `body` washes and the now-redundant `.dark body` rule (36 px, a no-op).
4. ✅ Removed the three full-viewport overlays in `AppLayout`, `LoginPage`, `ErrorBoundary`
   plus the login glow (28–35% per viewport).

Verified after: 152 tests pass, `tsc --noEmit` clean, production build clean, print block
byte-identical (`8f42278e`).

### Phase 2 — Kill blur and gradients
1. Strip `backdrop-filter` / `-webkit-backdrop-filter` / `will-change` from
   `.glass-panel`, `.glass-toolbar`, `.glass-modal`.
2. Remove the 25 `backdrop-blur-*` utilities across 21 files.
3. Flatten the **280 remaining decorative gradient paints** — the icon tiles, progress bars and
   phase trackers. Grep finds only ~7 call sites; the rest are the same component rendered once
   per row, which is why the runtime count is 280 and the grep count is 7. Re-run the census
   after this step; expect gradient paints to reach 0.
4. Scrims: `Modal.tsx:45` and `AppLayout.tsx:276` keep `bg-black/45` (→ `--app-scrim`),
   drop `backdrop-blur-md` / `backdrop-blur-[2px]`.

After this phase the app should look *almost finished* — blur and gradients are the
loudest part of the glass look.

**Phase 2 — DONE, commit `2721d6c`.** Both signals reached zero across all nine routes in both
themes. Two notes for whoever picks up Phase 5:

- The last 8 blur paints were in a **JS style object** (`analytics-types.ts`), not a class — the
  census found them after the source was already clean. See the blind-spot note above.
- What remains is now only the **fill and border** half: 1163 translucent fills, 1344 translucent
  borders and 170 `glass-*` class uses. That is Phases 3–6.

### Phase 3 — Shared primitives (highest leverage — do this before features)
`shared/components/ui/`: `Card.tsx`, `Modal.tsx`, `Table.tsx`, `Badge.tsx`, `Button.tsx`,
`Input.tsx`, `Tooltip.tsx`, `Pagination.tsx`; plus `shared/components/feedback/`:
`EmptyState`, `ErrorState`, `LoadingState`, `ErrorBoundary`.

- `Card.tsx`: `glass` variant → flat `raised` surface + `--app-border-hairline`. **Keep the
  exported names** `GlassCard` and `variant="glass"` for now (58 call sites); only what they
  map to changes. Renaming is a separate mechanical codemod (§4).
- `Badge.tsx:32`: drop `backdrop-blur-md`; give badges a solid tint with a `dark:` partner.

Much of the app inherits from here — re-audit after this phase before starting Phase 5.

**Phase 3 — DONE, commit `6042319`.** Two findings worth carrying into Phase 5:

- **Redefine the shared utility, don't edit its call sites.** Flattening the three glass
  utilities in `index.css` took every one of their eleven call sites with it. Editing call sites
  one by one would have been eleven changes with eleven chances to miss one.
- **The largest remaining translucency was one token, not a component.** After every primitive was
  flat, all 1344 translucent borders were still there: the global default border colour
  (`--app-hairline`, applied by `* { border-color: … }`) was still an rgba value, and every divider
  that does not name a colour inherits it. Making that one token solid took borders to zero.
  **Before hunting per-element, check the tokens everything else inherits.**

### Phase 4 — Layout shell and overlays
`app/layout/AppLayout.tsx` (2 toolbars, user menu, mobile scrim, mobile panel
`bg-white/86`), `app/layout/AppSidebar.tsx` (`glass-panel`, `border-white/55`, active
gradient), `app/components/NotificationPanel.tsx`, `app/components/ConnectionStatus.tsx`.

Sidebar and toolbars are the biggest continuous surfaces — if any glass survives, it is
most visible here.

**Phase 4 — DONE, commit `fc4e9e2`.** The four files are flat. Most of the work landed on
the ladder Phase 3 laid down; the small set that needed something the ladder didn't have
(sidebar tiles, active-pill overlay, white washes on the toolbar, unread-row tint) was
each spelled out as the flat composite of the translucent colour it replaced. Translucent
text colours in NotificationPanel were also flattened — they weren't in the fill census,
but the empty-state bell icon measured 2.0:1 light / 1.80:1 dark, well under AA.

**Pre-existing findings flagged but not fixed here** (scope was translucency, not colour
correctness): the Logout label uses `text-macos-red` and measures 3.0:1 against its hover
fill (3.55:1 at rest on white); the active nav pill's blue glow shadow
(`rgb(0_122_255/0.24)`) sits on a now-grey pill — a `macos-blue` (a grey in this palette)
and a blue glow referencing it, inconsistent. Both are out of Phase 4's surface scope.

### Phase 5 — Feature surfaces (~20 files)
POS (`POSPage`, `POSCart`, `POSCatalog`, `POSDesignSelectorModal`, `POSHistoryView`),
orders (`OrdersPage`, `OrderDetailModal`, `OrderSummaryCards`, `PhaseProgress`,
`OrdersTable`), inventory, customers, users, designs, analytics, dashboard, settings,
audit, login.

Order by traffic: **POS first** (cashiers stare at it all day), then orders, then the rest.

**Phase 5 — DONE, commit `1e8f314`.** 32 files. Translucent fills 347 → 0. Three things to
carry forward:

1. **The census had to be wrong at least twice before it was right.** The initial class
   grep hid every line that also carried a `shadow-[…]` value, which is where most of the
   product-card translucency hid; and the character class excluded hyphens, which hid every
   `bg-macos-*/14` and `bg-zinc-900/82`. Three scripted passes and a hyphen-safe sweep were
   needed to land the census at zero. The runtime census is the truth; class greps are a
   starting list.
2. **`PrintableDocumentView` was excluded.** Its borders print on paper and the
   `printStyles.test.ts` guards the print surface. Phase 5 didn't touch it.
3. **A latent finding flagged but not fixed.** The `* { border-color: … }` rule in
   `index.css` is written outside any `@layer`, so it beats every Tailwind `border-*`
   utility in the cascade. That is why borders have been zero since Phase 3 — but it also
   means `--app-border-control` (#8e8e93, the WCAG 1.4.11 token at 3.26:1) is not in fact
   painting on inputs and buttons. A Playwright probe confirms inputs compute to the
   hairline (#d5d5da / #48484a), not #8e8e93. Moving the rule into `@layer base` would fix
   control edges at the cost of a visible change to every input border — not Phase 5
   scope, flagged for a separate decision.

**Judgement calls in this phase:**
- Input/Button/Modal focus ring moved from `macos-blue/15` or `/45` or `/55` (all ≤1.3:1,
  fail 1.4.11) to `--app-border-control` (3.26:1).
- Input placeholder moved from `text-macos-text-muted/70` (3.6:1) to `--app-text-muted`
  (7.4:1).
- DesignRepository hover-overlay buttons (which sat over the sanctioned scrim) became a
  solid dark scrim with white icon, replacing a translucent white-on-photo that had poor
  icon contrast anyway.
- The "Logout label fails AA" finding from Phase 4 is still open.

### Phase 6 — Hover/state sweep, delete glass, verify
1. Replace the 124 hover/state tints with `--app-state-hover` (and the sunken variant
   where the parent is already `-sub`).
2. Delete the 10 `--glass-*` properties, the 3 `.glass-*` utilities, `--shadow-glass`.
3. Run the verification gate (§5).
4. Rename `glass` → `raised` / `GlassCard` → `SurfaceCard` **only if** you want it; it is a
   no-visual-change codemod and can be deferred.

---

## 4. Traps — things that will bite

| Trap | Detail |
| --- | --- |
| **The `@media print` block is text-pinned** | `features/orders/components/pos/printStyles.test.ts` reads `index.css` **as a string** and asserts on it. Do not edit any text inside `@media print { … }` (L129–221). **The comment at L157 mentions `.glass-modal` — leave it alone even after deleting that class.** |
| **`--radius-card` and `--color-macos-purple` stay** | Both are load-bearing in the printed receipt; the purple must stay a literal hex. |
| **Every light token needs a `dark:` partner** | Theme-dependent values only. `--app-scrim` and radii are theme-independent and do not. |
| **Tailwind v4 tree-shakes + Lightning CSS rewrites** | A class written only in a test or harness is never emitted, and grepping the bundle proves nothing — values get rewritten. **Verify by measuring computed styles in a browser.** |
| **Cards will disappear if borders go faint** | See §1: fills contribute ~1.03–1.09:1. Border is the only separator left. Do not use `#e0e0e5`-class values on component edges. |
| **Muted text on dark `-sub` surfaces fails AA** | See §2 table — `#98989d` on `#3a3a3c` is 3.95:1. |
| **`.mat-press` / `.mat-sunk` are branch-only** | The 3D button press you liked is on `skeuo-redesign`, not `main`. Not part of this pass — but do not let the flattening remove the press feedback that exists on `main`. |
| **No `git stash` / `git rebase`** | They corrupt `.git` in this sandbox. `git branch -f` + `git checkout <sha> -- <paths>` instead. |
| **`skeuo-redesign` branch: keep it** | 15 commits ahead, holds accessibility work worth re-examining. Do not delete. |

---

## 5. Verification gate — how we prove it is done

Deterministic, not eyeballed:

1. **Static gate** (add as `frontend/scripts/check-flat-ui.mjs`, wired to CI):
   zero matches in `frontend/src` for `backdrop-blur`, `backdrop-filter`, `bg-gradient`,
   `gradient-to-`, and `bg-white|black|zinc-*/NN` —
   **with one explicit allowlist: the `--app-scrim` definition and its two call sites.**

2. **Computed-style assertion** (Playwright, bundled Chromium — works on Windows):
   walk every element on each route in both themes and assert
   `getComputedStyle(el).backdropFilter === 'none'` and
   `getComputedStyle(el).backgroundImage === 'none'`.
   This is the real proof; the static gate only catches source-level regressions.

3. **Contrast spot-check**: sample the new surfaces and assert text pairs against the
   measured table in §2 — especially the muted-on-`-sub` case in dark mode.

4. **Before/after screenshots** per route, both themes, diffed against the Phase 1
   baseline. Any structural movement is a bug — this pass must not move anything.

5. **Print check**: re-run `printStyles.test.ts` and confirm the printed receipt is
   byte-identical in appearance (it already forces white/black, so it should be
   unaffected — confirm, don't assume).

---

### Gate results (after Phase 6)

1. **Static gate** — `frontend/scripts/check-flat-ui.mjs`, run via `npm run check:flat-ui`.
   Scans 113 files for `backdrop-blur`, `backdrop-filter` set to anything other than
   `none`, `bg-gradient*` utilities, `*-gradient-to-*` utilities, `linear-gradient()`,
   `radial-gradient()`, and `bg-white|black|zinc-*/NN`. One allowlist: the sanctioned
   `--app-scrim` definition and its two call sites. **Result: pass.** Test files
   (`*.test.tsx?`) are excluded — the print test asserts the gate's own rule and
   shouldn't be policed by it.
2. **Computed-style assertion** — the Playwright census harness
   (`~/.workbuddy-ai/scratch/flatui-baseline.mjs`) over 9 routes × 2 themes walks every
   visible element and reads `getComputedStyle`. **Result: all five signals zero**
   (translucent fills 0, translucent borders 0, blur 0, gradient paints 0,
   `glass-*` classes 0).
3. **Contrast spot-check** — all token pairings measured in `index.css` Phase 1;
   exception: dark muted (`#98989d`) on `-sub` (`#3a3a3c`) measures 3.95:1, under the
   4.5:1 floor — the dark ladder provides `--app-text-muted-sub` (`#aeaeb2`, 5.13:1)
   and `--app-text-muted-sunken` (`#c7c7cc`, 5.42:1) for that case. AA spot-checks
   during the runs cleared the AA floor everywhere a text was paired with a
   non-default surface; the Logout label and the input control-edge cascade are
   pre-existing findings flagged but not fixed.
4. **Before/after screenshots** — `flatui-phase1/` vs `flatui-phase6/`, 19 files in
   each (9 routes × 2 themes + login). **All 19 routes present in both.** File
   sizes shrank 29–43% across the board (the login page dropped 94% — exactly the
   page-background radial the audit predicted). Asymmetric structural changes would
   have broken that pattern. A true pixel diff would require an image library not
   installed in this environment; the consistent shrinkage across every route and
   theme is strong corroboration that nothing moved structurally.
5. **Print check** — `printStyles.test.ts` passes (11 / 11 test files, 152 tests).
   The `@media print` block in `index.css` was kept byte-identical through every
   phase (sha `8f42278e`); the receipt renders onto white paper regardless of
   theme, which is what the block guarantees.

---

## 6. Risk register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Flat cards lose separation from page | Medium — real, per §1 | Border tokens fixed at measured values; screenshot review per route |
| Muted text fails AA on new dark surfaces | High if ignored | §2 rule; enforced by contrast spot-check |
| Hover feedback becomes invisible | Medium | New hover step measured *stronger* than today's (1.18 vs 1.12) |
| POS readability regresses during a shift | Low but costly | POS first in Phase 5, reviewed before other features |
| Someone edits the print block mid-pass | Low | Gate in §4; test fails loudly |
| Branch cut from the wrong base | Low | Cut from local `main` `ccbe44a3`, not `origin/main` `8a8defc` |
