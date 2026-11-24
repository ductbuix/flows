import { useState, type ReactNode } from "react"
import { ChevronDown, Plus, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"

/** Collapsible section: heading with chevron, divider above all but the first. */
export function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Collapsible
      defaultOpen
      render={<section />}
      className="flex flex-col gap-1 border-t pt-4 first:border-t-0 first:pt-0"
    >
      <CollapsibleTrigger className="group/trigger flex w-fit items-center gap-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <h3 className="font-heading text-base font-medium">{title}</h3>
        <ChevronDown className="size-4 -rotate-90 text-muted-foreground transition-transform group-data-[panel-open]/trigger:rotate-0" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-0.5 pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function EmptyLine({ children = "None yet" }: { children?: ReactNode }) {
  return <p className="min-h-8 py-1.5 text-muted-foreground">{children}</p>
}

/** Label + value row for properties (editable or read only). */
export function Row({
  label,
  children,
  action,
}: {
  label: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="group/row flex min-h-8 items-center gap-2">
      <span className="w-28 shrink-0 truncate text-muted-foreground">
        {label}
      </span>
      <div className="flex min-h-8 min-w-0 flex-1 items-center">{children}</div>
      {action}
    </div>
  )
}

/** One list entry (ref, asset, link) with a hover highlight. */
export function ListRow({
  children,
  onOpen,
}: {
  children: ReactNode
  /** Makes the whole row open something; Enter and Space work too. */
  onOpen?: () => void
}) {
  return (
    <div
      className={`group/row -mx-2 flex min-h-8 items-center gap-2 rounded-md px-2 hover:bg-muted ${onOpen ? "cursor-pointer" : ""}`}
      {...(onOpen
        ? {
            role: "button",
            tabIndex: 0,
            onClick: onOpen,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onOpen()
              }
            },
          }
        : {})}
    >
      {children}
    </div>
  )
}

export function RemoveButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      className="ml-auto shrink-0 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <X />
    </Button>
  )
}

/** A ghost "+ Add x" button that reveals its inputs only when clicked. */
export function Adder({
  label,
  children,
}: {
  label: string
  children: (done: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <Button
        variant="ghost"
        className="-mx-2 w-fit justify-start px-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus />
        {label}
      </Button>
    )
  }
  const done = () => setOpen(false)
  return (
    <div className="flex gap-2">
      {children(done)}
      <Button variant="ghost" size="icon" aria-label="Cancel" onClick={done}>
        <X />
      </Button>
    </div>
  )
}
