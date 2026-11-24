import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@workspace/ui/components/combobox"

export type PickOption = { value: string; label: string; hint: string }

type Props = {
  options: PickOption[]
  value: string[]
  onChange: (value: string[]) => void
  label: string
  placeholder: string
  empty: string
}

/** Search and pick many: chips for what is chosen, a filtered list for the rest. Scales with the list. */
export function MultiPick({
  options,
  value,
  onChange,
  label,
  placeholder,
  empty,
}: Props) {
  const anchor = useComboboxAnchor()
  const selected = options.filter((o) => value.includes(o.value))
  return (
    <Combobox
      multiple
      items={options}
      value={selected}
      onValueChange={(next: PickOption[]) => onChange(next.map((o) => o.value))}
      itemToStringLabel={(o: PickOption) => o.label}
      itemToStringValue={(o: PickOption) => o.value}
      isItemEqualToValue={(a: PickOption, b: PickOption) => a.value === b.value}
    >
      <ComboboxChips
        ref={anchor}
        className="nodrag"
        data-testid={`pick-${label}`}
      >
        {selected.map((o) => (
          <ComboboxChip key={o.value}>{o.label}</ComboboxChip>
        ))}
        <ComboboxChipsInput
          aria-label={label}
          placeholder={selected.length === 0 ? placeholder : ""}
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{empty}</ComboboxEmpty>
        <ComboboxList>
          {(o: PickOption) => (
            <ComboboxItem
              key={o.value}
              value={o}
              data-testid={`pick-item-${o.value}`}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{o.label}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {o.hint}
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
