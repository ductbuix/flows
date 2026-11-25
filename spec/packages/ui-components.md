# `@workspace/ui` — components (`src/components/*.tsx`)

Companion to [ui.md](ui.md) and [ui-theme.md](ui-theme.md). Each
component file is imported as `@workspace/ui/components/<file>`.

"Stock" below means: the file is what `shadcn add <name>` emits for this
repo's `components.json` (style `base-nova`, base color `neutral`, icon
library `lucide`, `menuColor: default-translucent`, `menuAccent: subtle`)
with shadcn CLI 4.x (installed 4.23.0), then formatted by Prettier
(`prettier-plugin-tailwindcss` class sorting). Deviations from the first
generated version were verified against git history and are called out
as **Deviation**. A rebuild can regenerate stock parts with the CLI and
then apply the deviations; the class lists given here are the source of
truth if the CLI output has since drifted.

## Shared conventions

- **`data-slot`**: every rendered part sets `data-slot="<kebab-name>"`
  (listed per component). Parents style children with
  `has-data-[slot=…]`, `*:data-[slot=…]`, `in-data-[slot=…]`, and e2e /
  layout checks query them (`[data-slot=button]`, `[data-slot=input]`,
  `[data-slot=select-trigger]` must be 32 px tall on pages).
- **Base UI wrapping**: wrappers take `XPrimitive.Part.Props` types and
  spread props after their own (so callers can override). Polymorphism is
  Base UI's `render` prop (element or function), never Radix `asChild`.
- **`useRender` parts** (Badge, Item, BreadcrumbLink, ButtonGroupText,
  AttachmentTrigger, Sidebar group label/actions/menu buttons): built with
  `useRender({ defaultTagName, props: mergeProps(own, props), render,
state: { slot, …} })`. `state` keys become `data-*` attributes
  (`data-slot`, `data-variant`, `data-size`, `data-active`, `data-sidebar`).
- **Focus ring recipe**: `outline-none focus-visible:border-ring
focus-visible:ring-3 focus-visible:ring-ring/50` (some parts use
  `ring-[3px]`, identical).
- **Invalid recipe**: `aria-invalid:border-destructive aria-invalid:ring-3
aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50
dark:aria-invalid:ring-destructive/40`.
- **Icons**: lucide-react; `[&_svg:not([class*='size-'])]:size-4` default,
  `[&_svg]:pointer-events-none [&_svg]:shrink-0`. Icons inside buttons may
  carry `data-icon="inline-start" | "inline-end"` to tighten padding.
- **Overlay backdrop** (Dialog, AlertDialog, Sheet): `fixed inset-0 z-50
bg-black/10 supports-backdrop-filter:backdrop-blur-xs`, fade in/out
  100 ms (Sheet: opacity transition 150 ms).
- **Popup animation**: `data-open:animate-in data-open:fade-in-0
data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0
data-closed:zoom-out-95 duration-100`, plus
  `data-[side=bottom]:slide-in-from-top-2` (and the mirror for
  top/left/right/inline-start/inline-end).
- **Translucent menu block** (DropdownMenuContent, SubContent,
  SelectContent, ComboboxContent; from `menuColor: default-translucent`):
  `relative animate-none! bg-popover/70 shadow-md ring-1
ring-foreground/10 rounded-lg text-popover-foreground` plus a
  `before:` layer (`before:pointer-events-none before:absolute
before:inset-0 before:-z-1 before:rounded-[inherit]
before:backdrop-blur-2xl before:backdrop-saturate-150`) and descendant
  overrides (`menuAccent: subtle`): `**:data-[slot$=-item]:focus:bg-foreground/10`,
  `**:data-[slot$=-item]:data-highlighted:bg-foreground/10`,
  `**:data-[slot$=-separator]:bg-foreground/5`,
  `**:data-[slot$=-trigger]:focus:bg-foreground/10`,
  `**:data-[slot$=-trigger]:aria-expanded:bg-foreground/10!`,
  `**:data-[variant=destructive]:text-accent-foreground!`,
  `**:data-[variant=destructive]:**:text-accent-foreground!`,
  `**:data-[variant=destructive]:focus:bg-foreground/10!`. Note the
  `animate-none!` disables the enter/exit animation classes also present.
  Popover, HoverCard and Tooltip are **not** translucent.
- **Positioned popups** render `Portal > Positioner(className="isolate
z-50", side/align/offsets) > Popup`.

---

## Stock shadcn parts

### accordion — `@base-ui/react/accordion`

Exports `Accordion, AccordionItem, AccordionTrigger, AccordionContent`.
Slots `accordion` (`flex w-full flex-col`), `accordion-item`
(`not-last:border-b`), `accordion-trigger` (inside an unslotted
`AccordionPrimitive.Header className="flex"`), `accordion-trigger-icon`
(two icons: `ChevronDownIcon` hidden when `aria-expanded`, `ChevronUpIcon`
shown when expanded; `ml-auto size-4 text-muted-foreground`),
`accordion-content` (Panel `overflow-hidden text-sm
data-open:animate-accordion-down data-closed:animate-accordion-up`, inner
div `h-(--accordion-panel-height) pt-0 pb-2.5` with
`data-starting-style:h-0 data-ending-style:h-0`; `className` goes on the
inner div). Trigger: `rounded-lg py-2.5 text-left text-sm font-medium
hover:underline`.

### alert — plain div

Exports `Alert, AlertTitle, AlertDescription, AlertAction`. `alertVariants`
base `group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5
py-2 text-left text-sm`, svg child makes a 2-column grid
(`has-[>svg]:grid-cols-[auto_1fr] gap-x-2`, svg `row-span-2
translate-y-0.5 size-4`), with `AlertAction` present `pr-18`.

| variant       | classes                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `default`     | `bg-card text-card-foreground`                                                                      |
| `destructive` | `bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current` |

`role="alert"`. Slots `alert`, `alert-title` (`font-medium`,
col-start-2 when icon), `alert-description` (`text-sm text-balance
text-muted-foreground md:text-pretty`), `alert-action` (`absolute top-2
right-2`).

### alert-dialog — `@base-ui/react/alert-dialog` (`"use client"`)

Exports `AlertDialog, AlertDialogTrigger, AlertDialogPortal,
AlertDialogOverlay, AlertDialogContent, AlertDialogHeader,
AlertDialogFooter, AlertDialogMedia, AlertDialogTitle,
AlertDialogDescription, AlertDialogAction, AlertDialogCancel`.

- `AlertDialogContent({ size = "default" | "sm" })` renders Portal +
  Overlay + Popup (`data-slot=alert-dialog-content`, `data-size`):
  `fixed top-1/2 left-1/2 z-50 grid w-full -translate-1/2 gap-4
rounded-xl bg-popover p-4 ring-1 ring-foreground/10`, max width
  `max-w-xs` (both sizes), `sm:max-w-sm` for default.
- Header: centered grid; at `sm:` and size default, left-aligned; with a
  `alert-dialog-media` slot it becomes a 2-column layout.
- Footer: `-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t
bg-muted/50 p-4 sm:flex-row sm:justify-end`; size sm → 2-column grid.
- Media: `mb-2 inline-flex size-10 rounded-md bg-muted`, svg size-6.
- Title `font-heading text-base font-medium`; Description `text-sm
text-balance text-muted-foreground`.
- `AlertDialogAction` = `Button` with `data-slot=alert-dialog-action`.
- `AlertDialogCancel({ variant = "outline", size = "default" })` =
  `AlertDialogPrimitive.Close render={<Button variant size />}`.

### avatar — `@base-ui/react/avatar`

Exports `Avatar, AvatarImage, AvatarFallback, AvatarGroup,
AvatarGroupCount, AvatarBadge`. `Avatar({ size = "default" | "sm" |
"lg" })` → `data-size`; sizes `size-8` / `size-6` / `size-10`;
`rounded-full` with an `after:` 1 px `border-border` ring
(`after:mix-blend-darken`, dark `mix-blend-lighten`). Fallback
`bg-muted text-sm text-muted-foreground` (sm: `text-xs`). Badge: absolute
bottom-right dot `bg-primary ring-2 ring-background` sized per avatar size
(sm 2 / default 2.5 / lg 3). Group `flex -space-x-2`, children get
`ring-2 ring-background`; GroupCount matches avatar sizes.

### badge — `useRender` span

Exports `Badge, badgeVariants`. Base: `group/badge inline-flex h-5 w-fit
shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl
border border-transparent px-2 py-0.5 text-xs font-medium
whitespace-nowrap transition-all`, focus ring, invalid recipe,
`has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5
[&>svg]:pointer-events-none [&>svg]:size-3!`.

| variant (default `default`) | classes                                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`                   | `bg-primary text-primary-foreground [a]:hover:bg-primary/80`                                                                                                     |
| `secondary`                 | `bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80`                                                                                               |
| `destructive`               | `bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20` |
| `outline`                   | `border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground`                                                                               |
| `ghost`                     | `hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50`                                                                                              |
| `link`                      | `text-primary underline-offset-4 hover:underline`                                                                                                                |

State → `data-slot="badge"`, `data-variant`.

### breadcrumb — plain elements

Exports `Breadcrumb` (`nav aria-label="breadcrumb"`), `BreadcrumbList`
(`ol flex flex-wrap items-center gap-1.5 text-sm wrap-break-word
text-muted-foreground`), `BreadcrumbItem` (`li inline-flex items-center
gap-1`), `BreadcrumbLink` (`useRender` `a`, `transition-colors
hover:text-foreground`, slot via state), `BreadcrumbPage` (`span
role=link aria-disabled aria-current=page font-normal text-foreground`),
`BreadcrumbSeparator` (`li role=presentation aria-hidden`, children or
`ChevronRightIcon`, svg size-3.5), `BreadcrumbEllipsis`
(`MoreHorizontalIcon` + sr-only "More").

### button — `@base-ui/react/button`

Exports `Button, buttonVariants`. `data-slot="button"`. Props
`ButtonPrimitive.Props & VariantProps` with defaults `variant="default"`,
`size="default"`.

Base: `group/button inline-flex shrink-0 items-center justify-center
rounded-lg border border-transparent bg-clip-padding text-sm font-medium
whitespace-nowrap transition-all outline-none select-none` + focus ring +
`active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none
disabled:opacity-50` + invalid recipe + icon defaults (`size-4`).

| variant       | classes                                                                                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`     | `bg-primary text-primary-foreground hover:bg-primary/80`                                                                                                                                                                      |
| `outline`     | `border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50`                                             |
| `secondary`   | `bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground`                                              |
| `ghost`       | `hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50`                                                                                                            |
| `destructive` | `bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40` |
| `link`        | `text-primary underline-offset-4 hover:underline`                                                                                                                                                                             |

| size      | classes                                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default` | `h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2`                                                                                                                                    |
| `xs`      | `h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3`           |
| `sm`      | `h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5` |
| `lg`      | `h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2`                                                                                                                                    |
| `icon`    | `size-8`                                                                                                                                                                                                                  |
| `icon-xs` | `size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3`                                                                                                 |
| `icon-sm` | `size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg`                                                                                                                                      |
| `icon-lg` | `size-9`                                                                                                                                                                                                                  |
| `pill`    | `h-10 gap-2 rounded-full px-6`                                                                                                                                                                                            |

**Deviation**: `pill` size added (footer CTA in run cards; DESIGN.md).

### button-group — plain div + Separator

Exports `ButtonGroup, ButtonGroupText, ButtonGroupSeparator,
buttonGroupVariants`. `ButtonGroup` is `div role=group
data-slot=button-group data-orientation`; base `flex w-fit items-stretch
*:focus-visible:relative *:focus-visible:z-10
has-[>[data-slot=button-group]]:gap-2 [&>input]:flex-1` (+ select-trigger
fixes). `orientation` (default `horizontal`):

- `horizontal`: children lose right radius except the last
  (`rounded-r-lg!`), later children lose left radius and left border.
- `vertical`: `flex-col`, same with top/bottom.

`ButtonGroupText` (`useRender` div): `flex items-center gap-2 rounded-lg
border bg-muted px-2.5 text-sm font-medium`. `ButtonGroupSeparator`
(default `orientation="vertical"`): `relative self-stretch bg-input`
with 1 px margins.

### card — plain divs

Exports `Card, CardHeader, CardFooter, CardTitle, CardAction,
CardDescription, CardContent`.

- `Card({ size = "default" | "sm" })`: `data-slot=card data-size`;
  `group/card flex flex-col gap-(--card-spacing) overflow-hidden
rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground
ring-1 ring-foreground/10 [--card-spacing:--spacing(4)]
data-[size=sm]:[--card-spacing:--spacing(3)]`; with a footer `pb-0`;
  first-child img `pt-0` and rounded-top; last img rounded-bottom. No
  border, no shadow.
- `CardHeader`: `group/card-header @container/card-header grid
auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing)`;
  with `card-action` → `grid-cols-[1fr_auto]`; with description →
  `grid-rows-[auto_auto]`; `[.border-b]:pb-(--card-spacing)`.
- `CardTitle`: `font-heading text-base leading-snug font-medium`, sm card
  → `text-sm`.
- `CardDescription`: `text-sm text-muted-foreground`.
- `CardAction`: `col-start-2 row-span-2 row-start-1 self-start
justify-self-end`.
- `CardContent`: `px-(--card-spacing)`.
- `CardFooter`: `flex items-center rounded-b-xl border-t bg-muted/50
p-(--card-spacing)`.

### checkbox — `@base-ui/react/checkbox` (`"use client"`)

`Checkbox`: Root `data-slot=checkbox`, `peer relative flex size-4
rounded-[4px] border border-input` (+ `after:-inset-x-3 after:-inset-y-2`
hit area), checked `border-primary bg-primary text-primary-foreground`,
dark `bg-input/30`; Indicator `data-slot=checkbox-indicator` with
`CheckIcon` size 3.5.

### collapsible — `@base-ui/react/collapsible`

`Collapsible` (Root, slot `collapsible`), `CollapsibleTrigger`
(`collapsible-trigger`), `CollapsibleContent` (Panel,
`collapsible-content`). Pure passthrough, no classes.

### combobox — `@base-ui/react` `Combobox`

Exports `Combobox (= Root), ComboboxInput, ComboboxContent, ComboboxList,
ComboboxItem, ComboboxGroup, ComboboxLabel, ComboboxCollection,
ComboboxEmpty, ComboboxSeparator, ComboboxChips, ComboboxChip,
ComboboxChipsInput, ComboboxTrigger, ComboboxValue, useComboboxAnchor`.

- `ComboboxInput({ showTrigger = true, showClear = false, disabled })`:
  an `InputGroup className="w-auto"` holding `ComboboxPrimitive.Input
render={<InputGroupInput/>}` and an `inline-end` addon with an
  `InputGroupButton size="icon-xs" variant="ghost"
render={<ComboboxTrigger/>}` (hidden when a clear button is present)
  and optional `ComboboxClear` (X icon). Children render after the addon.
- `ComboboxTrigger` appends `ChevronDownIcon` (size-4, muted).
- `ComboboxContent` defaults `side="bottom" sideOffset=6 align="start"
alignOffset=0`, optional `anchor`; `data-chips={!!anchor}`; translucent
  menu block + `max-h-(--available-height) w-(--anchor-width)
max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))]`
  (chips: `min-w-(--anchor-width)`), inner `input-group` restyled (`m-1
mb-0 h-8 border-input/30 bg-input/30 shadow-none`).
- `ComboboxList`: `no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))]
scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0`.
- `ComboboxItem`: `relative flex w-full cursor-default items-center gap-2
rounded-md py-1 pr-8 pl-1.5 text-sm data-highlighted:bg-accent`, with
  `ItemIndicator` CheckIcon absolute right-2.
- `ComboboxLabel` `px-2 py-1.5 text-xs text-muted-foreground`;
  `ComboboxEmpty` hidden unless popup has `data-empty`; separator
  `-mx-1 my-1 h-px bg-border`.
- `ComboboxChips`: input-like `min-h-8 flex-wrap gap-1 rounded-lg border
border-input px-2.5 py-1` with focus-within ring; `ComboboxChip
({ showRemove = true })`: `h-[calc(--spacing(5.25))] rounded-sm bg-muted
px-1.5 text-xs font-medium`, remove = ghost `icon-xs` Button with X
  (`-ml-1 opacity-50 hover:opacity-100`); `ComboboxChipsInput` `min-w-16
flex-1 outline-none`.
- `useComboboxAnchor()` = `useRef<HTMLDivElement | null>(null)`.

### dialog — `@base-ui/react/dialog`

Exports `Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay,
DialogContent, DialogHeader, DialogFooter, DialogTitle,
DialogDescription`.

- `DialogContent({ showCloseButton = true })`: Portal + Overlay + Popup
  `fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)]
-translate-1/2 gap-4 rounded-xl bg-popover p-4 text-sm ring-1
ring-foreground/10 sm:max-w-sm`; close button =
  `DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm"
className="absolute top-2 right-2"/>}` with `XIcon` and sr-only
  "Close".
- `DialogHeader` `flex flex-col gap-2`.
- `DialogFooter({ showCloseButton = false })`: `-mx-4 -mb-4 flex
flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4
sm:flex-row sm:justify-end`; optional outline "Close" button.
- `DialogTitle` `font-heading text-base leading-none font-medium`;
  `DialogDescription` `text-sm text-muted-foreground`.

### dropdown-menu — `@base-ui/react/menu`

Exports `DropdownMenu (Root), DropdownMenuPortal, DropdownMenuTrigger,
DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel,
DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup,
DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut,
DropdownMenuSub (SubmenuRoot), DropdownMenuSubTrigger,
DropdownMenuSubContent`.

- Content defaults `align="start" alignOffset=0 side="bottom"
sideOffset=4`; Positioner `isolate z-50 outline-none`; Popup =
  translucent block + `z-50 max-h-(--available-height) w-(--anchor-width)
min-w-32 overflow-x-hidden overflow-y-auto p-1 outline-none
data-closed:overflow-hidden`.
- SubContent defaults `align="start" alignOffset=-3 side="right"
sideOffset=0`; translucent with `w-auto min-w-[96px] shadow-lg p-1`.
- `DropdownMenuItem({ inset, variant = "default" | "destructive" })`:
  `data-inset data-variant`; `group/dropdown-menu-item relative flex
cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm
focus:bg-accent data-inset:pl-7`; destructive: `text-destructive
focus:bg-destructive/10` (dark `/20`), svg destructive.
- SubTrigger: same row + `ChevronRightIcon ml-auto`, open state
  `bg-accent`.
- Checkbox / Radio items: `py-1 pr-8 pl-1.5`, indicator span
  (`dropdown-menu-checkbox-item-indicator` /
  `dropdown-menu-radio-item-indicator`) absolute `right-2` with CheckIcon.
- Label `px-1.5 py-1 text-xs font-medium text-muted-foreground
data-inset:pl-7`; Separator `-mx-1 my-1 h-px bg-border`; Shortcut
  `ml-auto text-xs tracking-widest text-muted-foreground`.

### empty — plain divs

Exports `Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent,
EmptyMedia`.

- `Empty`: `flex w-full min-w-0 flex-1 flex-col items-center
justify-center gap-4 rounded-xl p-6 text-center text-balance`.
  **Deviation**: stock has `border-dashed`; removed (DESIGN.md: sections
  add `ring-1 ring-foreground/10` themselves; page-level empties have no
  ring).
- `EmptyHeader` `flex max-w-sm flex-col items-center gap-2`.
- `EmptyMedia({ variant = "default" | "icon" })` (slot **`empty-icon`**,
  `data-variant`): base `mb-2 flex shrink-0 items-center justify-center`;
  `icon` → `size-8 rounded-lg bg-muted text-foreground` svg size-4.
- `EmptyTitle` `font-heading text-sm font-medium tracking-tight`;
  `EmptyDescription` (a `div`) `text-sm/relaxed text-muted-foreground`,
  links underlined; `EmptyContent` `flex w-full max-w-sm flex-col
items-center gap-2.5 text-sm text-balance`.

### field — plain elements + Label + Separator (`"use client"`)

Exports `Field, FieldLabel, FieldDescription, FieldError, FieldGroup,
FieldLegend, FieldSeparator, FieldSet, FieldContent, FieldTitle`.

- `FieldSet` `fieldset flex flex-col gap-4` (gap-3 with checkbox/radio
  group child).
- `FieldLegend({ variant = "legend" | "label" })`: `mb-1.5 font-medium`,
  legend `text-base`, label `text-sm`.
- `FieldGroup`: `group/field-group @container/field-group flex w-full
flex-col gap-5`, nested groups gap-4.
- `Field({ orientation = "vertical" })`: `div role=group data-slot=field
data-orientation`; base `group/field flex w-full gap-2
data-[invalid=true]:text-destructive`. Orientations: `vertical`
  (`flex-col *:w-full`), `horizontal` (`flex-row items-center`, label
  `flex-auto`, with `field-content` → `items-start`), `responsive`
  (vertical, horizontal at `@md/field-group`).
- `FieldContent` `group/field-content flex flex-1 flex-col gap-0.5
leading-snug`.
- `FieldLabel` (Label): `group/field-label peer/field-label flex w-fit
gap-2 leading-snug`; when wrapping a `field` it becomes a bordered
  selectable card (`rounded-lg border`, checked `border-primary/30
bg-primary/5`, child field `p-2.5`).
- `FieldTitle` (slot `field-label`) `text-sm font-medium`.
- `FieldDescription` `p text-left text-sm leading-normal font-normal
text-muted-foreground`.
- `FieldSeparator` with optional centered text on `bg-background`.
- `FieldError({ errors?: Array<{ message?: string } | undefined> })`:
  children win; else dedupe by message; one → text, many → `ul ml-4
list-disc`; none → `null`. `role=alert text-sm text-destructive`.

### hover-card — `@base-ui/react/preview-card`

`HoverCard`, `HoverCardTrigger`, `HoverCardContent` (defaults
`side="bottom" sideOffset=4 align="center" alignOffset=4`): `w-64
rounded-lg bg-popover p-2.5 text-sm shadow-md ring-1 ring-foreground/10`

- popup animation.

### input — `@base-ui/react/input`

`Input`: `data-slot=input`, `h-8 w-full min-w-0 rounded-lg border
border-input bg-transparent px-2.5 py-1 text-base md:text-sm
transition-colors placeholder:text-muted-foreground` + focus ring +
invalid; disabled `bg-input/50 opacity-50`; dark `bg-input/30`; file
input styles.

### input-group — plain divs (`"use client"`)

Exports `InputGroup, InputGroupAddon, InputGroupButton, InputGroupText,
InputGroupInput, InputGroupTextarea`. **Deviation**: `"use client"`
directive added at top (no behavior change).

- `InputGroup`: `div role=group data-slot=input-group`, `group/input-group
relative flex h-8 w-full min-w-0 items-center rounded-lg border
border-input`; focus ring when a `[data-slot=input-group-control]` is
  focus-visible; invalid when any slotted child has `aria-invalid=true`;
  becomes `h-auto flex-col` with block addons, `h-auto` with a textarea;
  dark `bg-input/30`.
- `InputGroupAddon({ align = "inline-start" })` (`role=group`,
  `data-align`); clicking the addon (not on a button) focuses the group's
  `input`. Base `flex h-auto cursor-text items-center justify-center
gap-2 py-1.5 text-sm font-medium text-muted-foreground`. Aligns:
  `inline-start` (`order-first pl-2`), `inline-end` (`order-last pr-2`),
  `block-start` (`order-first w-full justify-start px-2.5 pt-2`),
  `block-end` (`order-last w-full justify-start px-2.5 pb-2`).
- `InputGroupButton({ type = "button", variant = "ghost", size = "xs" })`
  is a `Button` with `data-size` and sizes: `xs` (`h-6 gap-1
rounded-[calc(var(--radius)-3px)] px-1.5`, svg 3.5), `sm` (no extra),
  `icon-xs` (`size-6 p-0`), `icon-sm` (`size-8 p-0`); base `flex
items-center gap-2 text-sm shadow-none`.
- `InputGroupText` span `flex items-center gap-2 text-sm
text-muted-foreground`.
- `InputGroupInput` / `InputGroupTextarea`: `Input` / `Textarea` with
  `data-slot=input-group-control` and borderless, transparent,
  ring-less classes (`flex-1 rounded-none border-0 bg-transparent
shadow-none`; textarea `resize-none py-2`).

### item — `useRender` div

Exports `Item, ItemMedia, ItemContent, ItemActions, ItemGroup,
ItemSeparator, ItemTitle, ItemDescription, ItemHeader, ItemFooter`.

`itemVariants` base: `group/item flex w-full flex-wrap items-center
rounded-lg border border-transparent text-sm transition-colors
duration-100 outline-none focus-visible:border-ring
focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors
[a]:hover:bg-muted`.

| variant   | classes                             | size      | classes                                                      |
| --------- | ----------------------------------- | --------- | ------------------------------------------------------------ |
| `default` | (none)                              | `default` | `gap-2.5 px-3 py-2.5`                                        |
| `outline` | `bg-card ring-1 ring-foreground/10` | `sm`      | `gap-2.5 px-3 py-2.5`                                        |
| `muted`   | `bg-muted/50`                       | `xs`      | `gap-2 px-2.5 py-2 in-data-[slot=dropdown-menu-content]:p-0` |

**Deviation**: stock uses a real border per variant (`default:
border-transparent`, `outline: border-border`, `muted:
border-transparent bg-muted/50`) with `border` in the base. Here the
base keeps `border border-transparent` (so focus can colour it) and
`outline` is ring-only with a card background (DESIGN.md "Surfaces:
ring-only").

State → `data-slot=item`, `data-variant`, `data-size`.

- `ItemGroup` `div role=list` `group/item-group flex w-full flex-col
gap-4` (gap-2.5 with sm items, gap-2 with xs).
- `ItemSeparator` horizontal `Separator my-2`.
- `ItemMedia({ variant = "default" | "icon" | "image" })`
  (`data-variant`): base `flex shrink-0 items-center justify-center
gap-2`, top-aligned when a description exists; `icon` svg size-4;
  `image` `size-10 overflow-hidden rounded-sm` (sm 8, xs 6).
- `ItemContent` `flex flex-1 flex-col gap-1` (xs gap-0).
- `ItemTitle` `line-clamp-1 flex w-fit items-center gap-2 text-sm
leading-snug font-medium underline-offset-4`.
- `ItemDescription` `p line-clamp-2 text-left text-sm leading-normal
font-normal text-muted-foreground` (xs `text-xs`).
- `ItemActions` `flex items-center gap-2`; `ItemHeader` / `ItemFooter`
  `flex basis-full items-center justify-between gap-2`.

### kbd — plain `kbd`

`Kbd` `pointer-events-none inline-flex h-5 w-fit min-w-5 items-center
justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs
font-medium text-muted-foreground select-none` (inside a tooltip:
`bg-background/20 text-background`). `KbdGroup` (`kbd`, slot
`kbd-group`) `inline-flex items-center gap-1`.

### label — plain `label` (`"use client"`)

`Label` `flex items-center gap-2 text-sm leading-none font-medium
select-none`, disabled via `group-data-[disabled=true]` or
`peer-disabled`.

### popover — `@base-ui/react/popover`

Exports `Popover, PopoverTrigger, PopoverContent, PopoverHeader,
PopoverTitle, PopoverDescription`. Content defaults `align="center"
alignOffset=0 side="bottom" sideOffset=4`: `z-50 flex w-72 flex-col
gap-2.5 rounded-lg bg-popover p-2.5 text-sm shadow-md ring-1
ring-foreground/10` + popup animation. Header `flex flex-col gap-0.5
text-sm`; Title `font-medium`; Description `text-muted-foreground`.

### progress — `@base-ui/react/progress`

`Progress({ value, children })` renders Root (`flex flex-wrap gap-3`),
children, then `ProgressTrack` (`relative flex h-1 w-full rounded-full
bg-muted overflow-x-hidden`) > `ProgressIndicator` (`h-full bg-primary
transition-all`). Also exports `ProgressTrack, ProgressIndicator,
ProgressLabel` (`text-sm font-medium`), `ProgressValue` (`ml-auto text-sm
text-muted-foreground tabular-nums`).

### resizable — `react-resizable-panels` v4 (`"use client"`)

`ResizablePanelGroup` (`Group`, `flex h-full w-full
aria-[orientation=vertical]:flex-col`), `ResizablePanel` (`Panel`),
`ResizableHandle({ withHandle })` (`Separator`, 1 px `bg-border` line
with a 4 px hit area via `after:`; horizontal orientation rotates;
`withHandle` adds a `h-6 w-1 rounded-lg bg-border` grip).

### scroll-area — `@base-ui/react/scroll-area`

`ScrollArea` = Root (`relative`) > Viewport (`size-full
rounded-[inherit]` with focus ring) + `ScrollBar` + Corner.
`ScrollBar({ orientation = "vertical" })`: `flex touch-none p-px
select-none`, vertical `h-full w-2.5 border-l border-l-transparent`,
horizontal `h-2.5 flex-col border-t border-t-transparent`; Thumb
`relative flex-1 rounded-full bg-border`.

### select — `@base-ui/react/select`

Exports `Select (= Root), SelectContent, SelectGroup, SelectItem,
SelectLabel, SelectScrollDownButton, SelectScrollUpButton,
SelectSeparator, SelectTrigger, SelectValue`.

- `SelectTrigger({ size = "default" | "sm" })`: `data-size`; `flex w-fit
items-center justify-between gap-1.5 rounded-lg border border-input
bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap`; default
  `h-8`, sm `h-7 rounded-[min(var(--radius-md),10px)]`; placeholder
  muted; value `line-clamp-1 flex items-center gap-1.5`; dark
  `bg-input/30 hover:bg-input/50`; trailing `SelectPrimitive.Icon
render={<ChevronDownIcon size-4 text-muted-foreground/>}`.
- `SelectContent` defaults `side="bottom" sideOffset=4 align="center"
alignOffset=0 alignItemWithTrigger=true` (`data-align-trigger`);
  translucent block + `isolate z-50 max-h-(--available-height)
w-(--anchor-width) min-w-36 overflow-y-auto`; contains scroll-up arrow,
  `SelectPrimitive.List`, scroll-down arrow.
- `SelectItem`: `relative flex w-full cursor-default items-center
gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm focus:bg-accent`; children
  in `ItemText` (`flex flex-1 shrink-0 gap-2 whitespace-nowrap`);
  `ItemIndicator` CheckIcon at `absolute right-2 size-4`.
- Group `scroll-my-1 p-1`; Label `px-1.5 py-1 text-xs
text-muted-foreground`; Separator `pointer-events-none -mx-1 my-1 h-px
bg-border`; Value `flex flex-1 text-left`; scroll arrows `bg-popover
py-1` with chevrons.

### separator — `@base-ui/react/separator`

`Separator({ orientation = "horizontal" })`: `shrink-0 bg-border`,
horizontal `h-px w-full`, vertical `w-px self-stretch`.

### sheet — `@base-ui/react/dialog`

Exports `Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader,
SheetFooter, SheetTitle, SheetDescription` (Portal/Overlay internal).

- `SheetContent({ side = "right", showCloseButton = true })`:
  `data-side`; `fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding
text-sm text-popover-foreground shadow-lg transition duration-200
ease-in-out`, starting/ending style `opacity-0` plus a 2.5 rem slide
  from its edge. Right/left: `inset-y-0 h-full w-3/4 sm:max-w-sm` with
  `border-l` / `border-r`; top/bottom: `inset-x-0 h-auto` with
  `border-b` / `border-t`. Close button: ghost `icon-sm` Button `absolute
top-3 right-3` with XIcon + sr-only "Close" (accessible name "Close" —
  e2e clicks `getByRole("button", { name: "Close" })`).
- `SheetHeader` `flex flex-col gap-0.5 p-4`; `SheetFooter` `mt-auto flex
flex-col gap-2 p-4`; `SheetTitle` `font-heading text-base font-medium
text-foreground`; `SheetDescription` `text-sm text-muted-foreground`.

### sidebar — composite (`"use client"`)

Constants: cookie `sidebar_state` (max-age 7 days, `path=/`), width
`16rem`, mobile width `18rem`, icon width `3rem`, shortcut ⌘/Ctrl+`b`.

Exports `SidebarProvider, Sidebar, SidebarTrigger, SidebarRail,
SidebarInset, SidebarInput, SidebarHeader, SidebarFooter,
SidebarSeparator, SidebarContent, SidebarGroup, SidebarGroupLabel,
SidebarGroupAction, SidebarGroupContent, SidebarMenu, SidebarMenuItem,
SidebarMenuButton, SidebarMenuAction, SidebarMenuBadge,
SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubItem,
SidebarMenuSubButton, useSidebar`.

- `useSidebar()` returns `{ state: "expanded" | "collapsed", open,
setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }`; throws
  `"useSidebar must be used within a SidebarProvider."` outside.
- `SidebarProvider({ defaultOpen = true, open, onOpenChange })`:
  controlled or internal state; `setOpen` also writes the cookie;
  `toggleSidebar` toggles mobile sheet when `useIsMobile()`, else
  desktop; window keydown ⌘/Ctrl+b toggles. Renders
  `div data-slot=sidebar-wrapper` with CSS vars `--sidebar-width`,
  `--sidebar-width-icon`, `group/sidebar-wrapper flex min-h-svh w-full
has-data-[variant=inset]:bg-sidebar`.
- `Sidebar({ side = "left", variant = "sidebar" | "floating" | "inset",
collapsible = "offcanvas" | "icon" | "none" })`:
  - `none`: plain `div data-slot=sidebar flex h-full w-(--sidebar-width)
flex-col bg-sidebar text-sidebar-foreground`.
  - mobile: `Sheet` with `SheetContent data-sidebar=sidebar
data-mobile=true` width 18rem, close button hidden, sr-only header
    "Sidebar" / "Displays the mobile sidebar.".
  - desktop: `div.group.peer hidden md:block` with `data-state`,
    `data-collapsible` (`collapsible` value only when collapsed, else
    `""`), `data-variant`, `data-side`; a `sidebar-gap` spacer that
    animates width (200 ms linear; 0 for offcanvas, icon width for
    icon); a `sidebar-container` `fixed inset-y-0 z-10 h-svh` that slides
    off-canvas, with `border-r`/`border-l` for the plain variant or
    `p-2` for floating/inset; inner `sidebar-inner`
    (`data-sidebar=sidebar`) `flex size-full flex-col bg-sidebar`
    (floating: `rounded-lg shadow-sm ring-1 ring-sidebar-border`).
- `SidebarTrigger`: ghost `icon-sm` Button with `PanelLeftIcon` and
  sr-only "Toggle Sidebar"; calls `onClick` then `toggleSidebar`.
- `SidebarRail`: invisible 16 px button on the sidebar edge (title
  "Toggle Sidebar"), resize cursors, 2 px hover line.
- `SidebarInset`: `main relative flex w-full flex-1 flex-col
bg-background` (inset variant: `m-2 ml-0 rounded-xl shadow-sm`).
- `SidebarInput` `Input h-8 w-full bg-background shadow-none`;
  `SidebarHeader`/`SidebarFooter` `flex flex-col gap-2 p-2`;
  `SidebarSeparator` `mx-2 w-auto bg-sidebar-border`; `SidebarContent`
  `no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto`
  (icon-collapsed: overflow-hidden); `SidebarGroup` `relative flex
w-full min-w-0 flex-col p-2`; `SidebarGroupLabel` (`useRender` div)
  `flex h-8 items-center rounded-md px-2 text-xs font-medium
text-sidebar-foreground/70`, hidden (`-mt-8 opacity-0`) when icon-
  collapsed; `SidebarGroupAction` (`useRender` button) `absolute top-3.5
right-3 w-5 aspect-square`; `SidebarGroupContent` `w-full text-sm`;
  `SidebarMenu` `ul flex w-full min-w-0 flex-col gap-0`;
  `SidebarMenuItem` `li group/menu-item relative`.
- `SidebarMenuButton({ isActive = false, variant = "default" |
"outline", size = "default" | "sm" | "lg", tooltip })` (`useRender`
  button; state `slot, sidebar: "menu-button", size, active`): base
  `peer/menu-button group/menu-button flex w-full items-center gap-2
overflow-hidden rounded-md p-2 text-left text-sm
hover:bg-sidebar-accent data-active:bg-sidebar-accent
data-active:font-medium [&_svg]:size-4 [&>span:last-child]:truncate`,
  icon-collapsed `size-8! p-2!`. Sizes: default `h-8 text-sm`, sm `h-7
text-xs`, lg `h-12 text-sm` (icon-collapsed `p-0!`). Outline:
  `bg-background shadow-[0_0_0_1px_var(--sidebar-border)]`. With
  `tooltip` (string or TooltipContent props) wraps in `Tooltip` with
  `TooltipContent side="right" align="center"` hidden unless collapsed
  and not mobile.
- `SidebarMenuAction({ showOnHover })`, `SidebarMenuBadge` (`absolute
right-1 h-5 min-w-5 rounded-md px-1 text-xs font-medium tabular-nums`),
  `SidebarMenuSkeleton({ showIcon })` (random 50–90 % text width via
  `--skeleton-width`), `SidebarMenuSub` (`ul mx-3.5 border-l
border-sidebar-border px-2.5 py-0.5`), `SidebarMenuSubItem`,
  `SidebarMenuSubButton({ size = "md" | "sm", isActive })` (`useRender`
  `a`, `h-7 rounded-md px-2`, md `text-sm`, sm `text-xs`).

### skeleton

`Skeleton` `div animate-pulse rounded-md bg-muted`.

### sonner — `sonner` + `next-themes`

`Toaster(props: ToasterProps)`: `theme = useTheme().theme ?? "system"`;
`className="toaster group"`; icons success `CircleCheckIcon`, info
`InfoIcon`, warning `TriangleAlertIcon`, error `OctagonXIcon`, loading
`Loader2Icon animate-spin` (all `size-4`); style vars `--normal-bg:
var(--popover)`, `--normal-text: var(--popover-foreground)`,
`--normal-border: var(--border)`, `--border-radius: var(--radius)`;
`toastOptions.classNames.toast = "cn-toast"`. **Deviation**: stock
`"use client"` removed (formatting only otherwise).

### spinner

`Spinner(props: ComponentProps<"svg">)`: `Loader2Icon data-slot=spinner
role=status aria-label="Loading" className="size-4 animate-spin"`.

### switch — `@base-ui/react/switch` (`"use client"`)

`Switch({ size = "default" | "sm" })`: Root `data-size`, `peer
group/switch relative inline-flex shrink-0 items-center rounded-full
border border-transparent`; default `h-[18.4px] w-[32px]`, sm `h-[14px]
w-[24px]`; checked `bg-primary`, unchecked `bg-input` (dark
`bg-input/80`); hit area `after:-inset-x-3 after:-inset-y-2`. Thumb
`block rounded-full bg-background`, default `size-4`, sm `size-3`,
checked `translate-x-[calc(100%-2px)]`; dark checked
`bg-primary-foreground`, dark unchecked `bg-foreground`.

### table — plain table elements

Exports `Table, TableHeader, TableBody, TableFooter, TableHead, TableRow,
TableCell, TableCaption`.

| Part           | Classes                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| container div  | `relative w-full overflow-hidden rounded-lg border` (slot `table-container`; not overridable)                                                        |
| `Table`        | `w-full caption-bottom text-sm`                                                                                                                      |
| `TableHeader`  | `bg-muted [&_tr]:border-b`                                                                                                                           |
| `TableBody`    | `[&_tr:last-child]:border-0`                                                                                                                         |
| `TableFooter`  | `border-t bg-muted/50 font-medium [&>tr]:last:border-b-0`                                                                                            |
| `TableRow`     | `border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted`                                          |
| `TableHead`    | `h-[41px] px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0`                                   |
| `TableCell`    | `max-w-xs truncate p-2 align-middle whitespace-nowrap has-[[data-slot=badge],[data-slot=button],[role=checkbox]]:py-0 [&:has([role=checkbox])]:pr-0` |
| `TableCaption` | `mt-4 text-sm text-muted-foreground`                                                                                                                 |

**Deviations** from stock: container `overflow-x-auto` → `overflow-hidden
rounded-lg border`; header gets `bg-muted`; head height `h-10` →
`h-[41px]` (so a header row equals a 40 px row + 1 px border); cell adds
`max-w-xs truncate` and zero vertical padding when it holds a badge,
button or checkbox.

### tabs — `@base-ui/react/tabs` (`"use client"`)

Exports `Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants`.

- `Tabs({ orientation = "horizontal" })`: `group/tabs flex gap-2`,
  horizontal → `flex-col`.
- `TabsList({ variant = "default" | "line" })` (`data-variant`): base
  `group/tabs-list inline-flex w-fit items-center justify-center
rounded-lg p-[3px] text-muted-foreground`, horizontal `h-8`, vertical
  `h-fit flex-col`; `default` `bg-muted`, `line` `gap-1 bg-transparent
rounded-none`.
- `TabsTrigger` (Tab): `relative inline-flex h-[calc(100%-1px)] flex-1
items-center justify-center gap-1.5 rounded-md border
border-transparent px-1.5 py-0.5 text-sm font-medium
text-foreground/60 hover:text-foreground`; active (default list)
  `bg-background text-foreground shadow-sm` (dark `border-input
bg-input/30`); line list: transparent, active shows a 2 px
  `bg-foreground` underline (`after:` at `bottom-[-5px]` horizontal or
  `-right-1` vertical).
- `TabsContent` (Panel) `flex-1 text-sm outline-none`.

### textarea — plain `textarea`

`Textarea`: `flex field-sizing-content min-h-16 w-full rounded-lg border
border-input bg-transparent px-2.5 py-2 text-base md:text-sm` + focus
ring + invalid; disabled `bg-input/50`; dark `bg-input/30`.

### toggle — `@base-ui/react/toggle` (`"use client"`)

Exports `Toggle, toggleVariants`. Base `group/toggle inline-flex
items-center justify-center gap-1 rounded-lg text-sm font-medium
whitespace-nowrap hover:bg-muted hover:text-foreground aria-pressed:bg-muted
data-[state=on]:bg-muted` + focus ring.

| variant   | classes                                             | size      | classes                                                                                             |
| --------- | --------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| `default` | `bg-transparent`                                    | `default` | `h-8 min-w-8 px-2.5` (icon padding 2)                                                               |
| `outline` | `border border-input bg-transparent hover:bg-muted` | `sm`      | `h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem]` (icon padding 1.5, svg 3.5) |
|           |                                                     | `lg`      | `h-9 min-w-9 px-2.5` (icon padding 2)                                                               |

### toggle-group — `@base-ui/react/toggle-group` + `toggle`

`ToggleGroup({ variant, size, spacing = 2, orientation = "horizontal" })`
sets `data-variant data-size data-spacing data-orientation`, style
`--gap: spacing`, `group/toggle-group flex w-fit flex-row items-center
gap-[--spacing(var(--gap))] rounded-lg` (vertical → `flex-col
items-stretch`), and provides context. `ToggleGroupItem` (Toggle,
`data-slot=toggle-group-item`) uses context variant/size over its own,
applies `toggleVariants`; with `spacing=0` items join (inner radii 0,
outline items collapse shared borders). Multi-select is Base UI's
`multiple` prop.

### tooltip — `@base-ui/react/tooltip` (`"use client"`)

Exports `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider`.
`TooltipProvider({ delay = 0 })`. `TooltipContent` defaults `side="top"
sideOffset=4 align="center" alignOffset=0`: `z-50 inline-flex w-fit
max-w-xs items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5
text-xs text-background` (inverted colors) + animation; `Arrow` `size-2.5
rotate-45 rounded-[2px] bg-foreground fill-foreground` positioned per
side.

---

## Custom part: command (cmdk-free)

`command.tsx` keeps shadcn's `command` API shape but has **no cmdk
dependency**. Exports `Command, CommandInput, CommandList, CommandEmpty,
CommandGroup, CommandItem, CommandSeparator`. Parts used outside
`<Command>` throw `"Command parts must sit inside <Command>"`.

State (context): `query`, `setQuery`, `register(id, visible)`,
`visibleCount` (count of registered items currently shown).

- `Command(props: div)`: `data-slot=command`, `flex size-full flex-col
overflow-hidden rounded-lg bg-popover text-popover-foreground`.
  Selection lives in the DOM: items carry `data-selected="true"|"false"`.
  Selectable item selector: `[data-slot=command-item]:not([hidden]):not([aria-disabled=true])`.
  After every `query` or `visibleCount` change, the first selectable item
  is marked selected and the rest unselected. `onKeyDown` (caller's
  handler runs first; skipped if it called `preventDefault`):
  ArrowDown/ArrowUp move selection with wrap-around and
  `scrollIntoView({ block: "nearest" })`; Enter clicks the selected item
  (or the first one).
- `CommandInput({ onValueChange, ...input })`: wrapper
  `data-slot=command-input-wrapper` `flex h-8 items-center gap-2
border-b px-2.5` with `SearchIcon size-4 opacity-50`; `input
data-slot=command-input autoFocus` controlled by `query`, calls
  `onValueChange(value)`; `w-full bg-transparent text-sm outline-hidden
placeholder:text-muted-foreground`.
- `CommandList`: `div role=listbox` `max-h-72 overflow-x-hidden
overflow-y-auto`.
- `CommandEmpty`: renders only when `visibleCount === 0`; `py-6
text-center text-sm`.
- `CommandGroup({ heading })`: `div role=group` `overflow-hidden p-1
text-foreground`; heading div `px-2 py-1.5 text-xs font-medium
text-muted-foreground`.
- `CommandSeparator`: `div role=separator -mx-1 h-px bg-border`.
- `CommandItem({ value, onSelect, disabled, children })`: `div
role=option data-slot=command-item`. Its label is its own
  `textContent` (re-read when children change). Shown when the trimmed
  query is empty or `"${value ?? ""} ${label}".toLowerCase()` includes
  the trimmed lower-cased query; hidden items get the `hidden`
  attribute. Registers visibility on mount/change, unregisters (false)
  on unmount. Click calls `onSelect()` unless disabled; mouse move
  selects this item (unselects all others in the root). Classes:
  `relative flex cursor-default items-center gap-2 rounded-md px-2
py-1.5 text-sm outline-hidden select-none aria-disabled:pointer-events-none
aria-disabled:opacity-50 data-[selected=true]:bg-muted`.

---

## AI Element patterns

Seven files carry the header comment "Adapted from shadcn
apps/v4/examples/base/<x>-demo.tsx (shadcn-ui/ui@bfa64ff). Changed
base-rhea to base-nova: imports use @workspace/ui/components/*, …; chat
demo wiring (useChat, Bubble, Message) removed." (`confirmation`,
`file-tree`, `plan`, `prompt-input`, `stack-trace`, `task`, `terminal`).
`trace`, `code-block` and `attachment` are slot-style parts in shadcn
form. All are domain-free. Several accept a `"data-testid"` prop and
forward it to their root.

### trace — Collapsible

Exports `Trace, TraceLine, TraceIcon, TraceTitle, TraceDescription,
TraceCollapsible, TraceCollapsibleTrigger, TraceCollapsibleContent`. The
base of Task, Plan, StackTrace and Terminal.

- `Trace` (div, slot `trace`): `flex w-full min-w-0 flex-col gap-2`;
  direct children that wrap a `trace-line` become `flex w-fit
max-w-full min-w-0 rounded-md text-left outline-none` with focus ring.
- `TraceLine({ status?: "running" | "error" | "pending" })` (span,
  `data-status`): `flex w-fit max-w-full min-w-0 items-center gap-2
text-sm text-muted-foreground transition-colors`; inside a link or
  button: pointer cursor and `text-foreground` on hover;
  `error` → `text-destructive` (stays on hover); `pending` →
  `opacity-60`; `running` → its `trace-title` gets `shimmer`.
- `TraceIcon` (span, `aria-hidden`): `flex size-4 shrink-0 items-center
justify-center`, svg size-4; after a title it pulls left `-ml-1`.
- `TraceTitle` (span): `min-w-0 truncate motion-reduce:shimmer-none`.
- `TraceDescription` (span): `shrink-0 text-muted-foreground/70
tabular-nums`.
- `TraceCollapsible` (Collapsible, slot `trace-collapsible`): `flex w-full
min-w-0 flex-col`. Type: uncontrolled (`open` undefined) or controlled
  (`open` + required `onOpenChange`).
- `TraceCollapsibleTrigger` (CollapsibleTrigger): `group/trace-collapsible-trigger
flex w-fit max-w-full min-w-0 cursor-pointer items-center gap-1
rounded-md text-left text-muted-foreground hover:text-foreground`
  (`text-destructive` when it holds an error line); appends a
  `TraceIcon` with `ChevronRightIcon` that rotates 90° when
  `aria-expanded`.
- `TraceCollapsibleContent` (CollapsibleContent): panel
  `h-(--collapsible-panel-height) min-w-0 overflow-hidden
transition-[height] duration-200` (0 at starting/ending style); inner
  div `trace-collapsible-content-inner` gets `className`: `mt-2 mb-1
ml-[calc(--spacing(2)-1px)] min-w-0 border-l pr-1 pl-4 leading-relaxed
wrap-break-word text-muted-foreground` (a left rail aligned under the
  icon centre).

### task

```ts
type TaskStep = {
  title: string
  status?: "running" | "error"
  icon?: ReactNode
  "data-testid"?: string
}
function Task(props: {
  title: string
  status?: "running" | "error"
  steps: TaskStep[]
  description?: ReactNode
  defaultOpen?: boolean
  "data-testid"?: string
}): JSX.Element
```

`Trace > TraceCollapsible(defaultOpen = defaultOpen ?? status ===
"running") > Trigger(TraceLine status, StatusIcon, title, optional
TraceDescription) + Content(keepMounted) > Trace` with one `TraceLine`
per step (key = title, forwards step `data-testid`; icon = `step.icon ??
StatusIcon`). `StatusIcon`: running → `LoaderCircleIcon animate-spin`,
error → `CircleAlertIcon`, else `CircleCheckIcon`.

### plan

```ts
type PlanStep = { title: string; status: "done" | "running" | "pending" }
function Plan(props: {
  title: string
  steps: PlanStep[]
  "data-testid"?: string
})
```

Trace with an open-by-default collapsible: header line (status
`running` if any step runs) with `RouteIcon`, title, description `"{done}
of {n} done"`; content lists steps: done → `CircleCheckIcon` (no
status), running → `CircleDotIcon` (status running), pending →
`CircleIcon` (status pending).

### stack-trace

```ts
function StackTrace(props: {
  error: string
  frames?: string[]
  defaultOpen?: boolean /* true */
  "data-testid"?: string
})
```

App frames = frames not containing `node_modules` or `node:`; internal =
the rest; shown = app frames if any, else all. Header line status `error`
with `CircleXIcon` and title `Failed: {error}`. Content (`flex flex-col
gap-2`): `p font-mono text-xs text-destructive` with the error; frames as
`ol flex flex-col gap-1 overflow-x-auto rounded-md bg-muted p-3
font-mono text-xs` (`li whitespace-nowrap`); when both app and internal
frames exist, a nested closed collapsible `{n} framework frames`
(`LayersIcon`) lists internal frames the same way.

### terminal

```ts
function Terminal(props: {
  title: string
  output: string
  status?: "running" | "error"
  defaultOpen?: boolean
  fill?: boolean
  "data-testid"?: string
})
```

Collapsible line with `TerminalIcon` + title (status passed through),
default open = `defaultOpen ?? (status === "running" && output.length >
0)`. Content: `CodeBlock size="sm"` > `CodeBlockContent wrap
data-testid="log-output"` with class `max-h-64` (or `max-h-none` when
`fill`), children = `output`.

### confirmation

```ts
function Confirmation(props: {
  title: string
  description?: string
  icon?: ReactNode
  approveLabel?: string /* "Approve" */
  denyLabel?: string /* "Deny" */
  onApprove(): void
  onDeny(): void
  pending?: boolean
  approveTestId?: string
  denyTestId?: string
  "data-testid"?: string
})
```

`Item variant="outline" size="sm"`: optional `ItemMedia variant="icon"`,
`ItemContent` (title, optional description), `ItemActions` with an
outline `sm` deny Button then a default `sm` approve Button; both
disabled while `pending`.

### file-tree — Collapsible + Button

```ts
type FileNode =
  | { type: "file"; name: string; path: string }
  | { type: "folder"; name: string; path: string; children: FileNode[] }
function FileTree(props: {
  roots: FileNode[]
  selected?: string
  onSelect?(path: string): void
  "data-testid"?: string
})
function pathsToFileTree(paths: string[]): FileNode[]
```

Root `div flex w-full flex-col text-sm`. Folder = `Collapsible
defaultOpen` with trigger rendered as ghost Button `w-full justify-start
font-normal` (no expanded background), `ChevronRightIcon` rotating 90°
when the panel is open (`group-data-panel-open/button:rotate-90`),
`FolderIcon`, name; children in `div ml-4 flex flex-col`. File = ghost
Button `w-full justify-start font-normal` with `FileIcon` + name;
selected adds `bg-accent text-accent-foreground` and
`aria-current="true"`; **`data-testid="out-file-<path>"`** (e2e relies on
it); click → `onSelect(path)`.

`pathsToFileTree`: splits each path on `/` (empty parts dropped), builds
nested folders (a folder path is the joined prefix), last part is a file;
output sorted per level folders first, then `localeCompare` by name.

### prompt-input — InputGroup

```ts
function PromptInput(props: {
  value: string
  onChange(v: string): void
  onSubmit(): void
  placeholder?: string /* "Write the agent prompt…" */
  disabled?: boolean
  submitLabel?: string /* "Save" */
  "data-testid"?: string
  submitTestId?: string
})
```

`form` (testid on it; submit → preventDefault, `onSubmit()` unless
disabled) > `InputGroup className="h-auto min-h-40 items-stretch"` >
`InputGroupTextarea rows=12 className="min-h-32 p-3 font-mono text-xs"`
(Enter without Shift submits; Shift+Enter newline) + `InputGroupAddon
align="block-end" className="justify-end border-t"` with an
`InputGroupButton type=submit size=sm variant=default className=ml-auto
aria-label={submitLabel}` containing `ArrowUpIcon` + label.

### suggestion

```ts
function Suggestions(props: ComponentProps<"div">) // "flex gap-2 overflow-x-auto overscroll-x-contain"
function Suggestion(props: { suggestion: string; onClick?(s: string): void })
```

`Suggestion` = `Button type=button variant=outline size=sm
className=shrink-0` showing the text; click → `onClick(suggestion)`.

### code-block

Exports `CodeBlock, CodeBlockHeader, CodeBlockTitle, CodeBlockActions,
CodeBlockCopyButton, CodeBlockContent, CodeBlockLine, CodeBlockFooter`
(`"use client"`). No syntax highlighting is built in.

- `CodeBlock({ variant = "default" | "destructive", size = "default" |
"sm" })` (`data-variant data-size`): base `group/code-block relative
flex w-full min-w-0 flex-col overflow-hidden rounded-lg text-sm`
  (sm `text-xs`), ring when content is focus-visible. `default`: `border
border-input text-foreground dark:bg-input/30` (focus `border-ring`);
  `destructive`: `border border-destructive/30 text-destructive
dark:border-destructive/40`.
- `CodeBlockHeader`: `flex items-center gap-2 px-3 pt-3
text-muted-foreground` (sm `px-2.5 pt-2.5`; destructive text).
- `CodeBlockTitle`: `min-w-0 truncate font-sans text-sm font-medium
text-foreground` (sm `text-xs`), inline svgs size-3.5 with `me-1.5`.
- `CodeBlockActions`: in a header, `ms-auto -my-1 -me-1.5 flex gap-1`;
  as a direct child of `code-block`, absolutely placed `top-2 end-2`
  (sm 1.5), hidden until hover/focus-within (always visible on coarse
  pointers), its buttons get `bg-background ring-1 ring-foreground/10`.
- `CodeBlockCopyButton({ value, variant = "ghost", size = "icon-xs" })`:
  writes `value` to `navigator.clipboard`; on success shows `CheckIcon`
  for 2000 ms (else `CopyIcon`), `aria-label` "Copied"/"Copy",
  `data-copied`, plus an `aria-live=polite` sr-only "Copied".
- `CodeBlockContent({ wrap = false, lineNumbers = false, startLine = 1 })`:
  `pre data-slot=code-block-content data-wrap data-numbered dir=ltr
tabIndex=0 style={{ counterReset: "line {startLine-1}" }}`: `min-h-0
min-w-0 overflow-auto px-3 py-3 text-start font-mono leading-relaxed
outline-none scroll-fade-x` (pt-2 after a header, pb-2 before a footer;
  sm `px-2.5 py-2.5`); `wrap` → `whitespace-pre-wrap wrap-break-word
scroll-fade-y`. Inner `code data-slot=code-block-code grid min-h-lh
min-w-max content-start` (numbered: `grid-cols-[auto_1fr]`, wrap:
  `min-w-0`). When `lineNumbers` and children is a string: trailing
  newline stripped, split on `\n`, each line a `CodeBlockLine`.
- `CodeBlockLine({ variant = "default" | "added" | "removed" |
"highlighted" })` (`data-variant`): `relative -mx-3 block min-h-lh px-3`
  with CSS counter line numbers (`before:content-[counter(line)]`,
  muted, `min-w-6 text-end`, unselectable) when numbered; `added` →
  `bg-muted` and `+` marker (`after:` at `start-1`), `removed` →
  `bg-destructive/10` and `−` marker in destructive, `highlighted` →
  `bg-muted`. Empty children render a literal `"\n"` so copied
  selections keep blank lines; content in
  `span data-slot=code-block-line-content min-w-0`.
- `CodeBlockFooter`: `flex items-center gap-2 px-3 pb-3
text-muted-foreground` (sm 2.5).

### attachment

Exports `Attachment, AttachmentGroup, AttachmentMedia, AttachmentContent,
AttachmentTitle, AttachmentDescription, AttachmentActions,
AttachmentAction, AttachmentTrigger`.

- `Attachment({ state = "done", size = "default", orientation =
"horizontal" })`, `state: "idle" | "uploading" | "processing" | "error"
| "done"` (`data-state data-size data-orientation`). Base
  `group/attachment relative flex w-fit max-w-full min-w-0 shrink-0
flex-wrap rounded-xl border bg-card text-card-foreground
transition-colors focus-within:ring-1 focus-within:ring-ring/50`;
  hover `bg-muted/50` when it has a direct link/button; error
  `border-destructive/30`; idle `border-dashed`. Sizes: default (`gap-2
text-sm`, content padding `px-2.5 py-2`, media `p-2`), sm (`gap-2.5
text-xs`, `px-2 py-1.5`, `p-1.5`), xs (`gap-1.5 rounded-lg text-xs`,
  `px-1.5 py-1`, `p-1`). Orientation: horizontal `min-w-40 items-center`;
  vertical `w-24 flex-col` (`w-30` with content). (cva has no
  defaultVariants; the component defaults supply them.)
- `AttachmentMedia({ variant = "icon" | "image" })`: `relative flex
aspect-square w-10 shrink-0 items-center justify-center overflow-hidden
rounded-lg bg-muted text-foreground` (vertical `w-full`, sm `w-8`, xs
  `w-7 rounded-md`; error `bg-destructive/10 text-destructive`); image
  variant `opacity-60` until done/idle, img cover.
- `AttachmentContent` `max-w-full min-w-0 flex-1 leading-tight`;
  `AttachmentTitle` `block truncate font-medium` with `shimmer` while
  uploading/processing; `AttachmentDescription` `mt-0.5 block truncate
text-xs text-muted-foreground` (error `text-destructive/80`).
- `AttachmentActions` `relative z-20 flex shrink-0 items-center`
  (vertical: absolute `top-3 right-3 gap-1`); `AttachmentAction` = Button
  `variant ?? "ghost"`, `size = "icon-xs"`.
- `AttachmentTrigger` (`useRender` button, default `type="button"` when
  no `render`): `absolute inset-0 z-10 outline-none` (whole-card hit
  area).
- `AttachmentGroup`: `flex min-w-0 snap-x snap-mandatory gap-3
overflow-x-auto overscroll-x-contain py-1 scroll-px-1 scroll-fade-x`,
  children `flex-none snap-start`.
