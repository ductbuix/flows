# DESIGN.md

UX and UI rules for the Flows web app. Read this before you design or code
any screen. Every pattern here has a live mockup at **`/brand`**
(`apps/web/src/pages/brand/`); open `/brand/<id>` to see it with its
anatomy, states and do/don't list. When this file and a mockup disagree,
fix one of them in the same change.

Older UI docs (DES-024 to DES-030, DES-036) still hold for lint, the page
frame and sizes. This file wins on look and product shape.

## 1. Product shape

Flows has **two pages**. Everything else lives inside them.

| Page           | Route                          | Job                                              | Mockups                              |
| -------------- | ------------------------------ | ------------------------------------------------ | ------------------------------------ |
| **Work items** | `/work-items`                  | A Kanban board of what needs doing and its state | `kanban`, `detail-panel`             |
| **Workflows**  | `/workflows`, `/workflows/:id` | Chains of nodes: build, run, watch, fix          | `canvas`, `run-card`, `detail-panel` |

- Runs, connections, library, settings and notices keep working under the
  hood. They surface **in context**: a run inside its workflow or work item,
  a sign-in as an attention pill next to the thing that needs it, settings
  in a detail panel. Do not add new top-level pages or sidebar entries.
- Old routes stay reachable for links and tests until a backlog removes
  them. New work targets the two pages.
- `/brand` is a reference page for agents and designers, not a product page.

## 2. Principles

1. **Say what is true now.** Status in plain words (Done, Needs sign-in,
   Step 2 of 4), live actions as verb phrases (Searching 4 repositories).
2. **One primary action per surface.** Filled button only once; everything
   else ghost or outline.
3. **Results over logs.** A finished step folds to its result line; detail
   is one click away (chevron, Sheet). Logs, ids and paths hide behind it.
4. **Calm by default, color for state.** Surfaces are neutral; color
   appears only to mean working, done, failed or needs you.
5. **Ask, don't configure.** Forms ask questions (What should it do?);
   advanced settings live in the detail panel, never in a create form.
6. **Never leave the board.** Open details in a right Sheet or panel so the
   board or canvas stays in view.

## 3. Foundations

### Color tokens

Only semantic tokens (`packages/ui/src/styles/globals.css`). Palette
classes (`text-green-600`, `bg-white`) fail lint.

| Token         | Means                               | Typical use                           |
| ------------- | ----------------------------------- | ------------------------------------- |
| `background`  | page and inner card                 | `bg-background`                       |
| `muted`       | outer card, lanes, insets           | `bg-muted`, `text-muted-foreground`   |
| `primary`     | the one filled action, solid avatar | `Button`, `KindAvatar kind="solid"`   |
| `info`        | working / live / selected           | `bg-info/10 text-info border-info/25` |
| `success`     | done / pass / output                | `bg-success/10 text-success`          |
| `warning`     | needs you / approval / judge        | `bg-warning/15`, icon `text-warning`  |
| `destructive` | failed / error                      | `bg-destructive/10 text-destructive`  |

Tint recipe: background `/10` (warning `/15`), border `/25`, text full.
Warning text stays `text-foreground` (contrast); only its icon is amber.
Map tones in one place: `TONE_CLASS` and `TONE_TEXT` in
`components/brand/StatusPill.tsx`.

### Type

- Headings `font-heading` (Figtree), weight medium. Body Inter.
- Page title `text-xl`, `CardTitle` `text-base`, body `text-sm`, meta
  `text-xs text-muted-foreground`.
- Numbers that change (durations, counts, tokens) use `mono` from
  `components/data/mono` plus `tabular-nums`.
- Sentence case everywhere. No ALL CAPS except a tiny inset label (INPUT).

### Shape and depth

Theme through shadcn CSS variables in
`packages/ui/src/styles/globals.css`
([theming](https://ui.shadcn.com/docs/theming.md)). Radius and control
heights come from the shadcn parts; never override them (lint).

| Rule            | Choice          | How                                                                                                                |
| --------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Radius          | Soft            | `--radius: 0.75rem` (scale `sm`…`4xl` derived)                                                                     |
| Base color      | Neutral         | default token set; no Stone/Zinc undertone                                                                         |
| Surfaces        | Ring-only       | `ring-1 ring-foreground/10` on Card, Item `outline`, floating toolbars, section `Empty`. No hard border for chrome |
| Inputs          | Outline         | Input, Textarea, Select keep `border-input`                                                                        |
| Depth           | Flat            | no card / hover shadows                                                                                            |
| Nesting         | Two-layer       | outer `Card className="bg-muted"` (or lane `rounded-2xl bg-muted`), plain inner `Card`                             |
| Primary         | Near-black      | default `--primary` / `--primary-foreground`                                                                       |
| Mode            | Light default   | `d` toggles dark; system stays available                                                                           |
| Sidebar         | Slightly tinted | `--sidebar` (redesign later)                                                                                       |
| Focus           | Subtle gray     | `--ring`                                                                                                           |
| Status / charts | Keep            | existing `--success` / `--info` / `--warning` / `--destructive`; neutral `chart-*`                                 |

Structural dividers stay (`border-t` / `border-b`, `Separator`, page
header). Status tint recipe still uses a soft border (`/25`) on pills.
Canvas wires and branch forks may use border edges as drawing, not
chrome. Board lanes and the canvas stage are the only hand-rolled
surfaces (`rounded-2xl`, no shadcn part). Pills: `Badge` and
`Button size="pill"`. Never `p-6` outside the page frame (lint).

### Icons

lucide only, `size-4` inline. Objects (a run, node kind, agent, app) get a
**`KindAvatar`**: shadcn `Avatar` + `AvatarFallback` with a kind tint
(`solid` for the object a header is about, a tone for node kinds).

## 4. Sourcing: shadcn first, never re-invent

Before you write markup, find the part in this order (DES-008):

1. `packages/ui/src/components` (already installed: shadcn parts and
   domain-free AI Element patterns).
2. shadcn components, https://ui.shadcn.com/docs/components.md. Add with
   `pnpm dlx shadcn@latest add <name> -c apps/web --dry-run` first; the CLI
   can rewrite `globals.css` and fonts, so review its diff.
3. AI Elements patterns, https://ui.shadcn.com/docs/ai-elements.md. Add
   base parts with the CLI, then copy the Base UI pattern into
   `packages/ui/src/components/` when it stays domain-free (no
   `@workspace/shared`). Flows-bound adaptations (e.g. `ModelSelector`
   on CLI catalog types) live in `apps/web/src/components/ai-elements/`.
4. Custom code only when none fits, built from the parts above, and listed
   in the table below with the reason.

| Need                                  | Use                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| Any card, panel, form shell           | `Card` + `CardHeader/Title/Description/Action/Content/Footer`                        |
| Card on a board, fact row, list row   | `Item` (`ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`, `ItemFooter`)  |
| State label, count, chip, edge label  | `Badge` (tints via `StatusPill`)                                                     |
| Object icon                           | `Avatar` (via `KindAvatar`)                                                          |
| Agent steps, a run, parallel branches | `Task` on `Trace` (`@workspace/ui/components/task`)                                  |
| Agent plan / todo list                | `Plan`, `Queue` (`@workspace/ui`)                                                    |
| Approval before an action             | `Confirmation` (`@workspace/ui/components/confirmation`)                             |
| Failed tool call, command output      | `StackTrace`, `Terminal` (`@workspace/ui`)                                           |
| Changed files                         | `FileTree` (`@workspace/ui/components/file-tree`)                                    |
| Model and effort pick                 | `ModelSelector` in `apps/web/.../ai-elements` (binds `@workspace/shared` types)      |
| One-click example prompts             | `Suggestion` (`@workspace/ui/components/suggestion`)                                 |
| Label + control rows, toggles         | `Field` (`orientation="horizontal"`), `FieldSet`, `FieldLegend`, `Switch`            |
| Multi-select chips                    | `ToggleGroup multiple variant="outline"`                                             |
| Path / back trail                     | `Breadcrumb`                                                                         |
| Icon input                            | `InputGroup` + `InputGroupAddon`                                                     |
| Detail on the side                    | `Sheet`; confirm with `AlertDialog` / `ConfirmDialog`                                |
| Empty / loading                       | `Empty` (section: `ring-1 ring-foreground/10`; page: no ring), `Skeleton`, `Spinner` |
| Canvas, node, edge, controls          | `@xyflow/react` + `Card` + `ButtonGroup` (AI Elements has no pattern)                |

**Allowed custom code** (`apps/web/src/components/brand/`), nothing else:

| Block                 | Why it exists                                     |
| --------------------- | ------------------------------------------------- |
| `StatusPill`          | `Badge` + the one tone → color map (`TONE_CLASS`) |
| `KindAvatar`          | `Avatar` + the kind → tint map                    |
| `StatRow`             | Footer stats; no shadcn part covers it            |
| `Button size="pill"`  | Variant added in `packages/ui` for the footer CTA |
| `bg-dot-grid` utility | Canvas and stage backdrop                         |

Do not draw tree lines, spinners, chips, tiles or card shells by hand.

## 5. Patterns

Each has a mockup at `/brand/<id>`; the registry spec there is the detail.

- **Status pill** (`status`). One per row, right end. Never raw enums.
- **Create form** (`create-form`). `Card` with back + `Breadcrumb`,
  `InputGroup` name, question labels, `Suggestion` examples, "It can use"
  `ToggleGroup`, Cancel + one primary named for the result. Max five fields.
- **Work items board** (`kanban`). Lanes Inbox, Running, Needs you, Done.
  The lane follows the latest run; users drag only Inbox ↔ Done. Card =
  `Item variant="outline"`: title, source line, footer with workflow + pill. Needs you cards get a warning ring.
- **Workflow canvas** (`canvas`). Top to bottom on a dot grid. Edge labels
  (`Badge`: When this happens, Do this, Pass/Fail). Node = `Card size="sm"`
  with `KindAvatar`, verb-phrase name, one muted line, optional inset. Floating toolbar bottom center.
- **Run card** (`run-card`). Muted `Card` with an inner `Card` holding a
  `Trace`: input line, split line, one `Task` per branch, answer; footer
  `StatRow` and Stop / Run again. Live steps shimmer; errors turn red.
- **Detail panel** (`detail-panel`). Action row (Switch, Edit, Run now),
  facts as `Item` rows with `Badge` chips, inline problems, `Field` Notify me
  switches, quiet Delete (confirm in a dialog). Switches save at once.

## 6. Copy

- Buttons: verb + object (Run now, Create workflow, Delete workflow). Never
  OK or Submit.
- Status: 1–3 words, present tense. Counts beat adjectives (3 working).
- Times: relative on cards (2h ago), absolute in panels (Fri 21 Nov, 17:00)
  via `RelativeTime`; no `toLocaleString` in pages (lint).
- Errors say what happened and what happens next: Rate limited, retrying.

## 7. States checklist

Every new surface shows: empty (one sentence on what lands here), loading
(Skeleton in the final shape), live (info), needs you (warning), failed
(destructive, with the next action), done (success), and dark mode.

## 8. Working with this system

1. Find the mockup on `/brand`. If none fits, add one first: a component in
   `src/pages/brand/mockups/<Name>Mockup.tsx` exporting a `Mockup` spec,
   listed in `registry.ts`. Keep files under 200 lines (split data out).
2. Update this file when a rule changes; add a DES-016 row for decisions.
3. Build the real screen from the same blocks. Add `data-testid`s and a
   Playwright check (`apps/e2e/tests/brand.spec.ts` covers `/brand`).
4. Check light and dark (`d` toggles) before you call it done.
