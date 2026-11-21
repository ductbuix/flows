import { useMemo, useState } from "react"
import type { WorkItemSummary } from "@workspace/shared"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

export const WORK_ITEM_NONE = "__none__"

type Props = {
  items: WorkItemSummary[]
  value: string | null
  onChange: (workItemId: string | null) => void
  disabled?: boolean
}

/** Searchable work item Select with "None, ad hoc" first (BL-041 / DES-025). */
export function WorkItemSelect({ items, value, onChange, disabled }: Props) {
  const [search, setSearch] = useState("")
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
    )
  }, [items, search])

  const selectValue = value ?? WORK_ITEM_NONE

  return (
    <Field>
      <FieldLabel>Work item</FieldLabel>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search work items"
        data-testid="workflow-start-work-item-search"
        disabled={disabled}
        className="mb-2"
      />
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (!v) return
          onChange(v === WORK_ITEM_NONE ? null : v)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          className="w-full"
          data-testid="workflow-start-work-item"
        >
          <SelectValue placeholder="None, ad hoc" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={WORK_ITEM_NONE}>None, ad hoc</SelectItem>
          {filtered.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
