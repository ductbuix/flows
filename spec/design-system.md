# Design system (from `apps/web/DESIGN.md`)

The UX/UI rules every Flows screen follows. Source of truth in the repo is
`apps/web/DESIGN.md` (207 lines); this is a precise restatement for a
rebuild. Token values: [packages/ui-theme.md](packages/ui-theme.md).
Component APIs: [packages/ui-components.md](packages/ui-components.md).
The web screens themselves are specified separately (apps/web spec).

DESIGN.md wins on look and product shape. Older UI docs DES-024 to DES-030
and DES-036 still govern lint rules, the page frame and sizes. Every
pattern has a live mockup at `/brand` (`apps/web/src/pages/brand/`);
`/brand/<id>` shows it with anatomy, states and a do/don't list. When
DESIGN.md and a mockup disagree, fix one of them in the same change.

## 1. Product shape

Two product pages; everything else lives inside them.

| Page      | Route                          | Job                                        | Mockups                              |
| --------- | ------------------------------ | ------------------------------------------ | ------------------------------------ |
| Docket    | `/docket`                      | Kanban board of what needs doing and state | `kanban`, `detail-panel`             |
| Workflows | `/workflows`, `/workflows/:id` | Chains of nodes: build, run, watch, fix    | `canvas`, `run-card`, `detail-panel` |

- Runs, connections, library, settings and notices surface **in
  context**: a run inside its workflow or work item, a sign-in as an
  attention pill next to what needs it, settings in a detail panel. No new
  top-level pages or sidebar entries.
- Older routes (`/inbox`, `/connectors`, `/library`, `/skills`, `/files`)
  stay reachable for links and tests until a backlog removes them; new
  work targets the two pages.
- `/brand` is a reference page for agents and designers, not a product
  page. Mockup ids: `status`, `create-form`, `kanban`, `canvas`,
  `run-card`, `detail-panel`, `node-ask`, `node-logs`.

## 2. Principles

1. **Say what is true now.** Plain-word status (Done, Needs sign-in,
   Step 2 of 4); live actions as verb phrases (Searching 4 repositories).
2. **One primary action per surface.** One filled button; everything else
   ghost or outline.
3. **Results over logs.** A finished step folds to its result line; detail
   is one click away (chevron, Sheet). Logs, ids and paths hide behind it.
4. **Calm by default, color for state.** Neutral surfaces; color only
   means working, done, failed or needs you.
5. **Ask, don't configure.** Forms ask questions ("What should it do?");
   advanced settings live in the detail panel, never in a create form.
6. **Never leave the board.** Details open in a right Sheet or panel so
   the board or canvas stays visible.

## 3. Foundations

### Color tokens

Only semantic tokens from `packages/ui/src/styles/globals.css`. Palette
classes (`text-green-600`, `bg-white`, …) fail lint.

| Token         | Means                               | Typical use                           |
| ------------- | ----------------------------------- | ------------------------------------- |
| `background`  | page and inner card                 | `bg-background`                       |
| `muted`       | outer card, lanes, insets           | `bg-muted`, `text-muted-foreground`   |
| `primary`     | the one filled action, solid avatar | `Button`, `KindAvatar kind="solid"`   |
| `info`        | working / live / selected           | `bg-info/10 text-info border-info/25` |
| `success`     | done / pass / output                | `bg-success/10 text-success`          |
| `warning`     | needs you / approval / judge        | `bg-warning/15`, icon `text-warning`  |
| `destructive` | failed / error                      | `bg-destructive/10 text-destructive`  |

**Tint recipe**: background `/10` (warning `/15`), border `/25`, text at
full strength. Warning text stays `text-foreground` for contrast; only
its icon is amber. Tones map to colors in exactly one place,
`apps/web/src/components/brand/StatusPill.tsx`:

| Tone        | `TONE_CLASS` (pill)                                        | `TONE_TEXT`             | Pill icon                             |
| ----------- | ---------------------------------------------------------- | ----------------------- | ------------------------------------- |
| `working`   | `border-info/25 bg-info/10 text-info`                      | `text-info`             | pulsing `size-1.5` dot (`bg-current`) |
| `done`      | `border-success/25 bg-success/10 text-success`             | `text-success`          | `Check`                               |
| `failed`    | `border-destructive/25 bg-destructive/10 text-destructive` | `text-destructive`      | `CircleX`                             |
| `attention` | `border-warning/30 bg-warning/15 text-foreground`          | `text-warning`          | `CircleAlert` (`text-warning`)        |
| `idle`      | `border-border bg-muted text-muted-foreground`             | `text-muted-foreground` | `Clock`                               |

`StatusPill` = `Badge variant="outline"` + `TONE_CLASS[tone]`,
`data-tone={tone}`, icon first then label. (Note the attention border is
`/30`, slightly stronger than the `/25` recipe.)

### Type

- Headings `font-heading` (Google Sans), weight medium. Body Google Sans.
- Page title `text-xl` (20 px; e2e asserts it), `CardTitle` `text-base`,
  body `text-sm`, meta `text-xs text-muted-foreground`.
- Numbers that change (durations, counts, tokens) use `mono` from
  `apps/web/src/components/data/mono` (the string `"font-mono"`) plus
  `tabular-nums`.
- Sentence case everywhere. No ALL CAPS except a tiny inset label (INPUT).

### Shape and depth

Theme only through shadcn CSS variables. Radius and control heights come
from the shadcn parts; never override them (lint bans `h-*`, `size-*`,
`rounded-*` overrides on shadcn parts outside allowed contexts).

| Rule            | Choice          | How                                                                                                                |
| --------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Radius          | Soft            | `--radius: 0.75rem`, scale `sm`…`4xl` derived                                                                      |
| Base color      | Neutral         | default token set; no Stone/Zinc undertone                                                                         |
| Surfaces        | Ring-only       | `ring-1 ring-foreground/10` on Card, Item `outline`, floating toolbars, section `Empty`; no hard border for chrome |
| Inputs          | Outline         | Input, Textarea, Select keep `border-input`                                                                        |
| Depth           | Flat            | no card or hover shadows                                                                                           |
| Nesting         | Two-layer       | outer `Card className="bg-muted"` (or lane `rounded-2xl bg-muted`), plain inner `Card`                             |
| Primary         | Near-black      | default `--primary` / `--primary-foreground`                                                                       |
| Mode            | Light default   | `d` toggles dark; system stays available                                                                           |
| Sidebar         | Slightly tinted | `--sidebar`                                                                                                        |
| Focus           | Subtle gray     | `--ring`                                                                                                           |
| Status / charts | Keep            | `--success` / `--info` / `--warning` / `--destructive`; neutral `chart-*`                                          |

- Structural dividers stay: `border-t` / `border-b`, `Separator`, page
  header.
- Status pills keep the soft `/25` border.
- Canvas wires and branch forks may use border edges as drawing, not
  chrome.
- Board lanes and the canvas stage are the only hand-rolled surfaces
  (`rounded-2xl`, no shadcn part); the stage uses the `bg-dot-grid`
  utility (16 px grid of 1 px `--border` dots).
- Pills: `Badge` and `Button size="pill"` (`h-10 rounded-full px-6`).
- Never `p-6` outside the page frame (lint).

### Icons

lucide only, `size-4` inline. Objects (a run, node kind, agent, app) get a
`KindAvatar`: `Avatar` + `AvatarFallback` with a kind tint:

| Kind      | Fallback classes                     | Use                          |
| --------- | ------------------------------------ | ---------------------------- |
| `solid`   | `bg-primary text-primary-foreground` | the object a header is about |
| `soft`    | `bg-muted text-foreground` (default) | neutral objects              |
| `info`    | `bg-info/10 text-info`               | node kinds that work / live  |
| `success` | `bg-success/10 text-success`         | output kinds                 |
| `warning` | `bg-warning/15 text-warning`         | approval / judge kinds       |

`KindAvatar({ kind = "soft", size?: "sm" | "default" | "lg", children })`.

## 4. Sourcing order (DES-008): shadcn first, never re-invent

1. `packages/ui/src/components` (installed shadcn parts and domain-free AI
   Element patterns).
2. shadcn components (ui.shadcn.com/docs/components). Add with
   `pnpm dlx shadcn@latest add <name> -c apps/web --dry-run` first; the
   CLI can rewrite `globals.css` and fonts, so review its diff.
3. AI Elements patterns (ui.shadcn.com/docs/ai-elements). Add base parts
   with the CLI, then copy the Base UI pattern into
   `packages/ui/src/components/` when it stays domain-free (no
   `@workspace/contracts`). Flows-bound adaptations (e.g. `ModelSelector`
   on CLI catalog types) live in `apps/web/src/components/ai-elements/`.
4. Custom code only when none fits, built from the parts above, and listed
   in the allowed table below.

| Need                                  | Use                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| Any card, panel, form shell           | `Card` + `CardHeader/Title/Description/Action/Content/Footer`                        |
| Card on a board, fact row, list row   | `Item` (`ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`, `ItemFooter`)  |
| State label, count, chip, edge label  | `Badge` (tints via `StatusPill`)                                                     |
| Object icon                           | `Avatar` (via `KindAvatar`)                                                          |
| Agent steps, a run, parallel branches | `Task` on `Trace`                                                                    |
| Agent plan / todo list                | `Plan`, `Queue`                                                                      |
| Approval before an action             | `Confirmation`                                                                       |
| Failed tool call, command output      | `StackTrace`, `Terminal`                                                             |
| Changed files                         | `FileTree`                                                                           |
| Model and effort pick                 | `ModelSelector` in `apps/web/.../ai-elements` (binds `@workspace/contracts` types)   |
| One-click example prompts             | `Suggestion`                                                                         |
| Label + control rows, toggles         | `Field` (`orientation="horizontal"`), `FieldSet`, `FieldLegend`, `Switch`            |
| Multi-select chips                    | `ToggleGroup multiple variant="outline"`                                             |
| Path / back trail                     | `Breadcrumb`                                                                         |
| Icon input                            | `InputGroup` + `InputGroupAddon`                                                     |
| Detail on the side                    | `Sheet`; confirm with `AlertDialog` / `ConfirmDialog`                                |
| Empty / loading                       | `Empty` (section: `ring-1 ring-foreground/10`; page: no ring), `Skeleton`, `Spinner` |
| Canvas, node, edge, controls          | `@xyflow/react` + `Card` + `ButtonGroup` (AI Elements has no pattern)                |

(DESIGN.md lists `Queue` but no `queue.tsx` exists in `packages/ui`
today.)

**Allowed custom code** (`apps/web/src/components/brand/`), nothing else:

| Block                 | Why it exists                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `StatusPill`          | `Badge` + the one tone → color map (`TONE_CLASS`)                                                                                                                                          |
| `KindAvatar`          | `Avatar` + the kind → tint map                                                                                                                                                             |
| `StatRow`             | Footer stats: `dl flex items-stretch`; each stat `flex flex-col gap-0.5 px-4` (first `pl-0`, others `border-l`), `dt text-xs text-muted-foreground`, `dd font-mono text-base tabular-nums` |
| `Button size="pill"`  | Variant added in `packages/ui` for the footer CTA                                                                                                                                          |
| `bg-dot-grid` utility | Canvas and stage backdrop                                                                                                                                                                  |

Do not draw tree lines, spinners, chips, tiles or card shells by hand.

## 5. Patterns (each has `/brand/<id>`)

- **Status pill** (`status`): one per row, at the right end. Never raw
  enums.
- **Create form** (`create-form`): `Card` with back button + `Breadcrumb`,
  `InputGroup` name, question labels, `Suggestion` examples, an "It can
  use" `ToggleGroup`, Cancel + one primary named for the result. Max five
  fields.
- **Work items board** (`kanban`): lanes Inbox, Running, Needs you, Done.
  The lane follows the latest run; users drag only Inbox ↔ Done. Card =
  `Item variant="outline"` with title, source line, footer with workflow +
  pill. Needs-you cards get a warning ring.
- **Workflow canvas** (`canvas`): top to bottom on a dot grid. Edge
  labels are `Badge`s (When this happens, Do this, Pass/Fail). Node =
  `Card size="sm"` with `KindAvatar`, verb-phrase name, one muted line,
  optional inset. Floating toolbar bottom centre.
- **Run card** (`run-card`): muted `Card` holding an inner `Card` with a
  `Trace`: input line, split line, one `Task` per branch, answer; footer
  `StatRow` and Stop / Run again. Live steps shimmer; errors turn red.
  (e2e: the mockup shows "3 working"; clicking Stop shows "Done" and
  "Answer".)
- **Detail panel** (`detail-panel`): action row (Switch, Edit, Run now),
  facts as `Item` rows with `Badge` chips, inline problems, `Field`
  "Notify me" switches, quiet Delete (confirmed in a dialog). Switches
  save at once.
- **Node ask** (`node-ask`): an open approval or permission sits on its
  canvas node as `Item variant="outline" size="sm"` with the warning tint:
  question, `Tool:` line, option buttons answered in place. Other ask
  kinds get one "Answer in Inbox" link.
- **Node logs** (`node-logs`): logs open only from the node's Logs button
  in a right `Sheet`: entries as `Terminal` / `Trace`, errors as
  `StackTrace`, `Skeleton` while loading, one sentence when empty. The
  canvas shows the result; logs never sit on it.

## 6. Copy

- Buttons: verb + object (Run now, Create workflow, Delete workflow).
  Never OK or Submit.
- Status: 1–3 words, present tense. Counts beat adjectives (3 working).
- Times: relative on cards (2h ago), absolute in panels (Fri 21 Nov,
  17:00) via `RelativeTime`; no `toLocaleString` in pages (lint).
- Errors say what happened and what happens next: "Rate limited,
  retrying."

## 7. States checklist

Every new surface shows: empty (one sentence on what lands here), loading
(`Skeleton` in the final shape), live (info), needs you (warning), failed
(destructive, with the next action), done (success), and dark mode.

## 8. Working with the system

1. Find the mockup on `/brand`. If none fits, add one first: a component
   in `src/pages/brand/mockups/<Name>Mockup.tsx` exporting a `Mockup`
   spec, listed in `registry.ts`. Keep files under 200 lines (split data
   out).
2. Update DESIGN.md when a rule changes; add a DES-016 row for decisions.
3. Build the real screen from the same blocks. Add `data-testid`s and a
   Playwright check (`apps/e2e/tests/brand.spec.ts` covers `/brand`).
4. Check light and dark (`d` toggles) before calling it done.

## Measurable layout rules (enforced by e2e `layout.spec.ts`)

At a 1440×900 viewport, on every app page except the Settings panel:

- the first `<header>` is exactly 48 px tall (`--header-height` =
  `calc(var(--spacing) * 12)`);
- the first `h1` starts at x = 280 px (256 px sidebar + 24 px gutter)
  and its computed font size is 20 px;
- the main content container (`[class~="@container/main"]`) has
  `padding-top: 24px`, and each of its direct children (except those with
  `data-bleed`) starts at x = 280;
- every visible `[data-slot=button]`, `[data-slot=input]` and
  `[data-slot=select-trigger]` is 32 px tall, except inside dense
  contexts (table cells/heads, item actions, input groups, sidebar,
  code blocks, graph canvas, prompt input, dialogs, React Flow nodes) and
  link-styled buttons (`underline-offset-4`).
