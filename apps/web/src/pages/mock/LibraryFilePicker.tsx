import { useMemo } from "react"
import { File, Image as ImageIcon } from "lucide-react"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import type { LibItem } from "./library-data"
import { useLibrary } from "./library-store"

/** The Library item and file a node's stored name points at. */
export function findLibraryFile(items: LibItem[], name: string) {
  for (const item of items) {
    const file = item.assets.find((a) => valueOf(item.title, a.name) === name)
    if (file) return { item, file }
  }
  return null
}

type Option = { value: string; label: string; item: string; image: boolean }

/** Stored on the node: `<item title>/<file path>`, so it stays readable in a run. */
const valueOf = (item: string, file: string) => `${item}/${file}`

/** A file from any Library item, filtered to the asset's type. */
export function LibraryFilePicker({
  kind,
  value,
  onChange,
}: {
  kind: "image" | "markdown"
  value: string
  onChange: (value: string) => void
}) {
  const items = useLibrary()
  const options = useMemo<Option[]>(
    () =>
      items.flatMap((i) =>
        i.assets
          .filter((a) => a.kind === (kind === "image" ? "image" : "md"))
          .map((a) => ({
            value: valueOf(i.title, a.name),
            label: a.name,
            item: i.title,
            image: kind === "image",
          }))
      ),
    [items, kind]
  )
  const selected = options.find((o) => o.value === value) ?? null
  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(o: Option | null) => o && onChange(o.value)}
      itemToStringLabel={(o: Option) => o.label}
      itemToStringValue={(o: Option) => o.value}
      isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
    >
      <ComboboxInput
        aria-label="File from the Library"
        placeholder="Choose from the Library"
        className="nodrag w-full"
        data-testid="asset-library-picker"
      />
      <ComboboxContent className="w-72">
        <ComboboxEmpty>
          No {kind === "image" ? "images" : "Markdown files"} in the Library
        </ComboboxEmpty>
        <ComboboxList>
          {(o: Option) => (
            <ComboboxItem key={o.value} value={o}>
              {o.image ? <ImageIcon /> : <File />}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{o.label}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {o.item}
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
