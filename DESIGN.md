# Helix IDE — Design System

This document describes the visual language of Helix IDE and how to extend it consistently.
It's a description of what already exists in `src/index.css` and the component tree, not an
aspirational spec — when in doubt, the code is the source of truth and this doc should be
updated to match it.

## 1. Design philosophy

Helix IDE is **"VS Code for genetic constructs."** The UI borrows directly from code-editor
and lab-instrument conventions rather than consumer-app ones:

- **Dark, dense, technical.** Near-black canvas, monospace-first, small type, tight spacing.
  This is a tool for people who will stare at it for hours, not a marketing surface.
- **One accent, used sparingly.** A single green accent (`--color-accent`) stands in for
  "active / selected / on / go" — evoking a gel electrophoresis readout or oscilloscope trace.
  Everything else is neutral until it needs to say something.
- **Color carries meaning, not decoration.** Nucleotide letters, feature types, and status
  text are colored according to fixed semantic maps (§6). If a color appears, it should be
  because the user can look it up in a legend, not because it looked nice.
- **Structure over chrome.** No drop shadows, no gradients, no rounded pill buttons, no
  card elevation. Hierarchy comes from borders, background-layer steps, and typography —
  the same toolkit a terminal UI or IDE uses.
- **Text is the primary UI material.** There is no icon library in this app. Labels are
  words (`Import…`, `Explain On`) or a small set of monospace glyphs (`▶ ◀ ★`). Don't
  introduce an icon set without a strong reason — it would be the single biggest visual
  departure from the current system.

## 2. Color system

Defined once as CSS custom properties in `src/index.css` under `@theme`, consumed via
Tailwind v4 arbitrary-value syntax (`bg-(--color-bg-surface)`, `text-(--color-accent)`, etc).
There is currently **one theme** (dark) — no light-mode variant exists in the app.

### 2.1 Surface & structure

| Token | Hex | Role |
|---|---|---|
| `--color-bg-canvas` | `#0d1117` | The deepest layer — main content background, sequence editor background |
| `--color-bg-surface` | `#12161f` | Chrome layer — top bar, sidebars, tab bar, panel backgrounds |
| `--color-bg-elevated` | `#181d29` | Reserved for elements that sit above `surface` (menus, popovers) |
| `--color-bg-hover` | `#202634` | Hover / active row background (list items, buttons-as-rows) |
| `--color-border` | `#262c3b` | Default hairline — panel dividers, header/footer rules |
| `--color-border-strong` | `#333c50` | Interactive-element borders — inputs, buttons, selects |

These four background steps (`canvas` → `surface` → `elevated` → `hover`) form a strict
depth ladder. Each step up is used for "this sits above/on top of the previous layer" — never
skip a step or use them interchangeably.

### 2.2 Text

| Token | Hex | Role |
|---|---|---|
| `--color-text-primary` | `#e6e9ef` | Body text, sequence letters (default), values |
| `--color-text-secondary` | `#9aa4b8` | Labels, inactive tab/list text, secondary values |
| `--color-text-muted` | `#626d82` | Section headers (uppercase eyebrows), hints, placeholders, position numbers |

Never use pure white (`#fff`) or pure black — everything sits inside this three-step gray
scale so the UI reads as one calm surface rather than high-contrast panels.

### 2.3 Accent & status

| Token | Hex | Role |
|---|---|---|
| `--color-accent` | `#4ade80` (green) | Active state, selected tab, "on" toggles, brand wordmark, primary CTA border/text |
| `--color-accent-dim` | `#1f6b45` | Accent background fill (selection highlight, active-toggle fill, Explain block border) |
| `--color-accent-fg` | `#04140a` | Foreground text/icon color *on top of* a solid accent fill (reserved; not yet used on a filled button) |
| `--color-warn` | `#f5a524` (amber) | Warnings, promoter-type features, search-match highlight |
| `--color-danger` | `#f75f5f` (red) | Errors, destructive/terminator-type features |
| `--color-info` | `#5b9cf5` (blue) | Informational, gene-type features |

**Accent usage rule:** the green accent means "this is active/true/selected right now,"
never "this is important" or "this is clickable." A button being clickable is communicated by
a neutral border (`border-strong`) plus a hover state — see §6.1.

### 2.4 Nucleotide colors

A fixed, app-wide legend for the four DNA bases, used everywhere raw sequence is rendered
(sequence editor, primers, diffs):

| Base | Token | Hex |
|---|---|---|
| A | `--color-base-a` | `#f75f5f` (red) |
| T | `--color-base-t` | `#5b9cf5` (blue) |
| G | `--color-base-g` | `#f5a524` (amber) |
| C | `--color-base-c` | `#4ade80` (green) |

These intentionally reuse the status hues (danger/info/warn/accent) rather than inventing a
fifth palette — the app only ever needs one set of four saturated colors, so status and
base-pair color-coding share it. Keep this mapping stable; it's the one piece of color the
user is expected to memorize.

### 2.5 Feature-type colors

Genetic feature annotations (promoter, CDS, terminator, etc.) map to a fixed palette
(`src/data/featureColors.ts`), used consistently in the feature list, the linear/circular
map, and the feature strip:

| Feature type | Color |
|---|---|
| `CDS` | accent (green) |
| `gene` | info (blue) |
| `promoter` | warn (amber) |
| `terminator` | danger (red) |
| `regulatory` | base-g (amber) |
| `origin` | text-secondary (gray) |
| `misc` | text-muted (gray) |

When adding a new `FeatureType`, add its color here first — never let a feature render in an
arbitrary/unmapped color.

## 3. Typography

Two font families, both loaded as CSS variables:

```
--font-mono: 'JetBrains Mono', 'Cascadia Code', ui-monospace, 'SF Mono', Menlo, Consolas, monospace
--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif
```

- **Monospace is the dominant voice of the app.** Sequence data, positions, stat values,
  buttons, tabs, badges, form inputs, the wordmark — almost every piece of UI chrome and all
  biological data is `font-mono`. This is deliberate: it reinforces the "editor for
  biological code" framing and keeps columns of bases/numbers aligned.
- **Sans-serif (`Inter`) is the fallback for `<body>`** and is rarely seen directly — most
  components override it with `font-mono`. Treat sans as the exception, not the rule, when
  building new UI.
- **Type scale is small and flat.** Effectively three sizes in use: `text-[11px]`/`text-xs`
  (12px, the workhorse — labels, buttons, stat values, list items), `text-sm` (14px — tab
  bar, construct name), and `text-[13px]`/`text-[9px]` for a couple of specific spots (the
  sequence editor body, the "unique" badge). There is no large display type anywhere in the
  app — this UI never needs a hero heading.
- **Section headers** ("CONSTRUCTS", "FEATURES", "CONSTRUCT", "SELECTION") are
  `text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)` — quiet
  eyebrow labels, not visually loud headings.
- **Sentence case for interactive labels** (`Load example…`, `Import…`, `Substitute`),
  **UPPERCASE for structural section headers**. Don't mix the two roles.

## 4. Layout anatomy

The whole app is a single fixed-viewport IDE shell (`h-screen w-screen overflow-hidden` —
the window itself never scrolls; individual panels do). Structure, top to bottom:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TopBar (h-11)  Helix IDE / <construct name>       [Import…] [Explain On]│
├───────────┬─────────────────────────────────────────────┬───────────────┤
│ Construct │                                             │  Inspector    │
│ Explorer  │              Active view                    │  (w-64)       │
│ (w-56)    │        (Sequence / Map / Protein / …)        │  Construct    │
│           │                                             │  Feature      │
│ Constructs│                                             │  Selection    │
│ Features  │                                             │  stats        │
├───────────┴─────────────────────────────────────────────┴───────────────┤
│ FeatureMapStrip (max-h-40) — always-visible mini linear map              │
├───────────────────────────────────────────────────────────────────────────┤
│ ViewTabs (h-9)  Sequence Map Protein Mutations Restriction PCR Compare … │
└─────────────────────────────────────────────────────────────────────────┘
```

- **TopBar** — app identity + global actions. Always `bg-surface`, bottom border.
- **Left sidebar (Construct Explorer)** — persistent navigation: loaded constructs, then
  that construct's features. Fixed width, own scroll region.
- **Center (main view)** — the one thing that changes; renders whichever of the eight views
  is active. Owns `min-w-0 flex-1` so it's the flexible panel that yields space.
- **Right sidebar (Inspector)** — read-only, live-updating detail panel: Construct → Feature
  → Selection, in that fixed stacking order, each as its own labeled group. Fixed width
  (`w-64`), always present even with nothing selected ("Nothing selected.").
- **Feature map strip** — a condensed, always-on version of the linear map, independent of
  which tab is active, so spatial context (where you are in the construct) never disappears.
- **View tabs** — bottom-anchored, not top-anchored. This is a deliberate inversion of the
  usual browser-tab position; it keeps tabs next to the always-visible map strip they
  control and out of the way of the content above.

**Panel chrome convention:** every panel/sidebar/bar follows the same recipe —
`bg-(--color-bg-surface)` fill, a single `border` (never multiple sides unless it's a fully
enclosed box) in `--color-border`, and padding of `px-3 py-2` (or `p-3` for a full panel).
Panels never use `bg-canvas` for their own chrome — only the innermost content area
(sequence text, the map strip's SVG background) sits on canvas.

## 5. Spacing & sizing

- **No 8pt-grid dogma** — the app uses Tailwind's default scale pragmatically, but leans
  small: `gap-1.5`, `gap-2`, `px-1.5`, `py-0.5` are common. Err toward the tighter end of
  Tailwind's scale; this is a dense data tool, not a landing page.
- **Fixed pixel widths for structural panels**, not percentages: sidebar `w-56`, inspector
  `w-64`, enzyme list `w-52`, search input `w-56`. Structural chrome should have a
  predictable, non-reflowing width; only the center view is fluid.
- **Fixed row heights** for anything list-like or virtualized: `h-11` top bar, `h-9` tabs,
  `ROW_HEIGHT = 20` for sequence rows. This matters because the sequence editor is
  virtualized (`react-window`) — row height must stay in sync with the actual rendered
  row's height.
- **Corner radius is minimal and uniform**: `rounded` (4px) everywhere — buttons, inputs,
  badges, selection highlight. Never `rounded-lg`/`rounded-xl`/`rounded-full` on anything.
  A single consistent small radius reinforces the "flat instrument panel" feel; anything
  rounder would read as a consumer app.
- **Borders are 1px**, using the two border tokens (§2.1). The only 2px border in the app is
  the active-tab top indicator (`border-t-2`), used specifically as a state indicator, not
  as decoration.

## 6. Components

### 6.1 Buttons

One shared recipe, three states, no filled/primary variant exists yet:

```
rounded border px-2 py-1 font-mono text-xs transition-colors
```

- **Default (secondary):** `border-(--color-border-strong) text-(--color-text-secondary)`,
  hover → `hover:border-(--color-text-muted)`. This is the button used for ~everything
  (`Import…`, `Substitute`, `Insert Before`, `Delete Selection`).
- **Active/toggled-on:** swaps to the accent trio —
  `border-(--color-accent-dim) bg-(--color-accent-dim) text-(--color-accent)`. Used for
  stateful toggles like `Explain On` once enabled. This is the closest thing to a "primary"
  button in the app, and it's reserved for *state*, not *importance* — don't use it for a
  one-off call-to-action.
- **Disabled:** `disabled:cursor-not-allowed disabled:opacity-40`. Never remove the border/
  label on disable — just fade it.
- **Drag-target state** (file import): border and text switch to accent color while a file
  is dragged over, independent of the toggle-on treatment above.
- Always `transition-colors` — the only motion in this app is color/background
  interpolation on hover/focus. No transforms, no shadows, no scale.

### 6.2 Tabs

Two tab patterns exist, both bottom/top-border indicators rather than filled pills:

- **View tabs** (bottom bar): inactive = transparent 2px top border,
  `text-secondary`, hover → `text-primary`. Active = `border-t-2 border-accent`,
  `bg-canvas` (visually "sinks" into the content below it), `text-accent`.
- **List-as-tabs** (construct list, feature list): no border indicator — active row gets
  `bg-hover` + `text-accent`; inactive rows get `text-secondary` and only show `bg-hover` on
  actual `:hover`.

### 6.3 Inputs & selects

```
rounded border border-(--color-border-strong) bg-(--color-bg-canvas)
px-2 py-1 font-mono text-xs text-(--color-text-primary)
placeholder:text-(--color-text-muted)
focus:border-(--color-accent) focus:outline-none
```

- Background is always `bg-canvas` (one step darker than the surface it sits in) so inputs
  visually recess into the panel. The focus ring is the border turning accent-green, not a
  browser default `outline` or a glow — always pair `focus:outline-none` with
  `focus:border-(--color-accent)`.
- Placeholder text uses `--color-text-muted`, matching the general "muted = hint" convention.
- Checkboxes use the native input with `accent-(--color-accent)` — no custom checkbox
  component. Keep it that way; a custom control would be inconsistent with how little
  custom-chrome the rest of the app has.

### 6.4 Badges

Small inline tags, e.g. the "unique" cutter badge:

```
rounded bg-(--color-accent-dim) px-1 text-[9px] text-(--color-accent)
```

Badge = accent-dim fill + accent text, same pairing as the active-toggle button. Reserve
this treatment for "this item has a notable/true property," not general labeling.

### 6.5 Stat rows (Inspector pattern)

The Inspector's `StatRow` — `label` in `text-xs text-muted`, `value` right-aligned in
`font-mono text-xs text-primary`, `flex justify-between items-baseline` — is the canonical
way to show a key/value fact. Reuse this component (or its exact classes) any time a panel
needs to present read-only structured data; don't invent a table or definition-list variant.

### 6.6 Explain blocks

`ExplainBlock` — an accent-dim-bordered, canvas-background, monospace box that shows
step-by-step biological reasoning when Explain Mode is on:

```
space-y-1.5 rounded border border-(--color-accent-dim) bg-(--color-bg-canvas)
px-3 py-2 font-mono text-xs
```

This is the app's one "callout" pattern. Its accent-dim border (rather than a full accent
border or a background fill) keeps it legible without shouting — use this exact treatment
for any future "here's what's happening under the hood" content, and don't create a second
callout style (no yellow "info box," no card-with-shadow).

### 6.7 Tracks / strips (linear map, GC content)

Feature tracks render as full-bleed, borderless colored bars with left-aligned label text
overlaid directly on the fill (see `▶ minimal promoter` etc. in the map view) — not as
discrete rounded chips floating on a background. The GC-content sparkline is a plain SVG/line
trace in accent green with a dashed average line, no axis chrome beyond position ticks. Both
favor maximum data density over illustrative polish — this is a plot you read precisely, not
a decorative graphic.

## 7. Interaction states

| State | Treatment |
|---|---|
| Hover (buttons) | Border lightens (`border-strong` → `text-muted`) |
| Hover (rows/list items) | Background steps up one layer (`→ bg-hover`) |
| Focus (inputs) | Border turns accent green; no native outline/ring |
| Selected (sequence bases) | `bg-accent-dim` fill behind the base glyph |
| Search match (sequence bases) | `bg-warn/40` — translucent amber, distinct from selection |
| Active/current (tabs, list rows) | `text-accent`, plus a top-border or background cue |
| Disabled | `opacity-40` + `cursor-not-allowed`, structure stays intact |
| Error text | `text-danger`, plain inline text — no toast/alert component exists |
| Warning text | `text-warn`, same inline treatment as error |

There is no modal, toast, or notification-center pattern anywhere in the app — transient
feedback (import errors/warnings, mutation errors) is always shown as inline colored text
next to the control that produced it. Keep new error/warning UI inline; don't introduce a
toast system.

## 8. Iconography & glyphs

No icon library is installed (no lucide/heroicons/etc — see `package.json`). The app's only
non-text glyphs are:

- `▶` / `◀` — strand direction (forward/reverse), colored by feature type.
- `★` — flags a notable table row (e.g. a unique restriction cutter in the cut-sites table).
- `/` — breadcrumb separator in the TopBar (`Helix IDE / MINIMAL_CDS`).
- `…` (ellipsis, not three periods) — trailing punctuation on buttons that open a
  file picker or dropdown (`Import…`, `Load example…`).

If a future feature genuinely needs an icon (e.g. a settings gear, a close ×), prefer a
single Unicode glyph in `font-mono` over pulling in an icon library — it's a smaller
departure from the current system and keeps the bundle dependency-free.

## 9. Voice & microcopy

- Lowercase, terse, technical phrasing: "Search sequence (exact match)…",
  "Select a single base, then type A/T/G/C to introduce a substitution."
- Status line at the very bottom-left of content areas states raw facts tersely:
  `4 features · 152 bp · linear` — counts separated by middle-dots, no filler words.
  This is a "status bar" idiom borrowed straight from code editors.
- Buttons are verbs (`Substitute`, `Insert Before`, `Delete Selection`), never vague
  (`Submit`, `Go`, `OK`).
- Empty/placeholder states are one plain sentence, no illustration:
  "Nothing selected.", "No annotated features.", "No construct loaded".
- `title` attributes are used generously as the app's only tooltip mechanism — every
  non-obvious button/row has one. Keep using native `title` rather than a custom tooltip
  component.

## 10. Extending this system

When adding a new view or component:

1. Reuse an existing pattern from §6 before inventing a new one. This app has ~6 component
   idioms total (button, tab, input, badge, stat-row, callout) — that's a feature, not a gap.
2. New status/semantic colors should map onto the existing four (`accent`/`warn`/`danger`/
   `info`) rather than adding a fifth hue. If a truly new *category* of thing needs a color
   (e.g. a new feature type), extend the relevant lookup table (`featureColors.ts`) rather
   than hardcoding a hex value in a component.
3. Stay in `font-mono` for anything that is data, a control, or chrome. Reach for
   `font-sans` only for long-form prose (there isn't any yet).
4. Keep radii at `rounded` (4px), borders at 1px in `--color-border` or
   `--color-border-strong`, and background steps within the four-layer ladder in §2.1.
5. No shadows, gradients, blur, or animation beyond `transition-colors`. If a design would
   need any of those to work, it's probably the wrong pattern for this app.
