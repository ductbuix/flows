import { useEffect, useState } from "react"
import { memoryListSchema } from "@workspace/shared"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@workspace/ui/components/combobox"
import { api } from "@/lib/api"

type Props = {
  workflowId: string
  value: readonly string[]
  /** `undefined` clears the setting. */
  onChange: (value: string[] | undefined) => void
}

/** Memory files copied into the node's input (`memory/<name>.md`). */
export function MemoryCombobox({ workflowId, value, onChange }: Props) {
  const anchor = useComboboxAnchor()
  const [open, setOpen] = useState(false)
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.workflows[":workflowId"].memory.$get({
        param: { workflowId },
      })
      if (!res.ok || !alive) return
      setNames(memoryListSchema.parse(await res.json()).files.map((f) => f.name))
    })()
    return () => {
      alive = false
    }
  }, [workflowId])

  const items = [
    ...new Set([...names.map((n) => `memory/${n}`), ...value]),
  ]
  return (
    <Combobox
      multiple
      open={open}
      onOpenChange={setOpen}
      items={items}
      value={[...value]}
      onValueChange={(next: string[]) => onChange(next.length ? next : undefined)}
    >
      <ComboboxChips ref={anchor} data-testid="node-memory">
        <ComboboxValue>
          {(picked: string[]) => (
            <>
              {picked.map((p) => (
                <ComboboxChip key={p}>{p.replace(/^memory\//, "")}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                aria-label="Memory files"
                // With the list closed, Esc is the Sheet's: it must not clear the picks.
                onKeyDown={(e) => {
                  if (e.key === "Escape" && !open) e.preventBaseUIHandler()
                }}
                placeholder={picked.length ? "" : "Add memory file"}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No memory files</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item.replace(/^memory\//, "")}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
