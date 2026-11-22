import * as React from "react"
import { SearchIcon } from "lucide-react"
import { cn } from "cn"

/**
 * Searchable list in the shadcn `command` shape (Command, CommandInput,
 * CommandList, CommandEmpty, CommandGroup, CommandItem), without cmdk:
 * items filter by their text and value, arrows move, Enter picks.
 */

type CommandContextValue = {
  query: string
  setQuery: (q: string) => void
  register: (id: string, visible: boolean) => void
  visibleCount: number
}

const CommandContext = React.createContext<CommandContextValue | null>(null)

function useCommand() {
  const ctx = React.useContext(CommandContext)
  if (!ctx) throw new Error("Command parts must sit inside <Command>")
  return ctx
}

const ITEM = "[data-slot=command-item]:not([hidden]):not([aria-disabled=true])"

function Command({ className, onKeyDown, ...props }: React.ComponentProps<"div">) {
  const [query, setQuery] = React.useState("")
  const [visible, setVisible] = React.useState<Record<string, boolean>>({})
  const register = React.useCallback((id: string, v: boolean) => {
    setVisible((prev) => (prev[id] === v ? prev : { ...prev, [id]: v }))
  }, [])
  const visibleCount = Object.values(visible).filter(Boolean).length
  const ref = React.useRef<HTMLDivElement>(null)

  // Keep one item selected: the first visible one after each query change.
  React.useEffect(() => {
    const items = ref.current?.querySelectorAll<HTMLElement>(ITEM)
    items?.forEach((el, i) =>
      el.setAttribute("data-selected", i === 0 ? "true" : "false")
    )
  }, [query, visibleCount])

  return (
    <CommandContext.Provider value={{ query, setQuery, register, visibleCount }}>
      <div
        ref={ref}
        data-slot="command"
        className={cn(
          "flex size-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground",
          className
        )}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          if (e.defaultPrevented) return
          const root = ref.current
          if (!root) return
          const items = [...root.querySelectorAll<HTMLElement>(ITEM)]
          const at = items.findIndex((el) => el.dataset.selected === "true")
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault()
            if (items.length === 0) return
            const step = e.key === "ArrowDown" ? 1 : -1
            const next = (at + step + items.length) % items.length
            items.forEach((el, i) =>
              el.setAttribute("data-selected", i === next ? "true" : "false")
            )
            items[next]?.scrollIntoView({ block: "nearest" })
          } else if (e.key === "Enter") {
            e.preventDefault()
            items[Math.max(at, 0)]?.click()
          }
        }}
        {...props}
      />
    </CommandContext.Provider>
  )
}

function CommandInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  const { query, setQuery } = useCommand()
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-8 items-center gap-2 border-b px-2.5"
    >
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <input
        data-slot="command-input"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={cn(
          "w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-list"
      role="listbox"
      className={cn("max-h-72 overflow-x-hidden overflow-y-auto", className)}
      {...props}
    />
  )
}

function CommandEmpty({ className, ...props }: React.ComponentProps<"div">) {
  const { visibleCount } = useCommand()
  if (visibleCount > 0) return null
  return (
    <div
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "heading"> & { heading?: React.ReactNode }) {
  return (
    <div
      data-slot="command-group"
      role="group"
      className={cn("overflow-hidden p-1 text-foreground", className)}
      {...props}
    >
      {heading ? (
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function CommandSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-separator"
      role="separator"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  value,
  onSelect,
  children,
  disabled,
  ...props
}: Omit<React.ComponentProps<"div">, "onSelect"> & {
  value?: string
  onSelect?: () => void
  disabled?: boolean
}) {
  const { query, register } = useCommand()
  const id = React.useId()
  const text = React.useRef<HTMLDivElement>(null)
  const [label, setLabel] = React.useState("")
  React.useEffect(() => {
    setLabel(text.current?.textContent ?? "")
  }, [children])
  const haystack = `${value ?? ""} ${label}`.toLowerCase()
  const shown = query.trim() === "" || haystack.includes(query.trim().toLowerCase())
  React.useEffect(() => {
    register(id, shown)
    return () => register(id, false)
  }, [id, shown, register])
  return (
    <div
      ref={text}
      data-slot="command-item"
      role="option"
      hidden={!shown}
      aria-disabled={disabled || undefined}
      data-selected="false"
      onClick={() => {
        if (!disabled) onSelect?.()
      }}
      onMouseMove={(e) => {
        const root = e.currentTarget.closest("[data-slot=command]")
        root
          ?.querySelectorAll("[data-slot=command-item]")
          .forEach((el) => el.setAttribute("data-selected", "false"))
        e.currentTarget.setAttribute("data-selected", "true")
      }}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden select-none data-[selected=true]:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
}
