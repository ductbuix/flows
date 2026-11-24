import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"

export type ComboOption = { value: string; label: string }

type Props = {
  label: string
  options: ComboOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder: string
  testId: string
  error?: string
  disabled?: boolean
}

/** Labelled searchable picker (Combobox) over a short list of options. */
export function EntityCombobox({
  label,
  options,
  value,
  onChange,
  placeholder,
  testId,
  error,
  disabled,
}: Props) {
  const selected = options.find((o) => o.value === value) ?? null
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel>{label}</FieldLabel>
      <Combobox
        items={options}
        value={selected}
        onValueChange={(next: ComboOption | null) =>
          onChange(next?.value ?? null)
        }
        itemToStringLabel={(o: ComboOption) => o.label}
        itemToStringValue={(o: ComboOption) => o.value}
        isItemEqualToValue={(a: ComboOption, b: ComboOption) =>
          a.value === b.value
        }
        disabled={disabled}
      >
        <ComboboxInput
          placeholder={placeholder}
          data-testid={testId}
          className="w-full"
          disabled={disabled}
        />
        <ComboboxContent>
          <ComboboxEmpty>No match</ComboboxEmpty>
          <ComboboxList>
            {(item: ComboOption) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
