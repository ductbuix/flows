import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { EFFORTS, MODELS, PROVIDERS, type FlowData } from "./flow-data"

type Opt = { value: string; label: string }

function Pick({
  value,
  options,
  onChange,
  grow,
  label,
}: {
  value?: string
  options: Opt[]
  onChange: (v: string) => void
  grow?: boolean
  label: string
}) {
  return (
    <Select
      value={value ?? options[0]!.value}
      items={options}
      onValueChange={(v) => v && onChange(v)}
    >
      <SelectTrigger
        aria-label={label}
        className={`nodrag border-transparent bg-transparent px-2 shadow-none hover:bg-background/60 dark:bg-transparent ${grow ? "min-w-0 flex-1" : ""}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** AI provider, model and effort of an LLM or Condition node. */
export function ModelRow({
  data,
  onChange,
}: {
  data: FlowData
  onChange: (patch: Partial<FlowData>) => void
}) {
  return (
    <div className="-mx-2 flex items-center gap-0.5">
      <Pick
        label="Provider"
        value={data.provider}
        options={PROVIDERS}
        onChange={(provider) => onChange({ provider })}
      />
      <Pick
        grow
        label="Model"
        value={data.model}
        options={MODELS}
        onChange={(model) => onChange({ model })}
      />
      <Pick
        label="Effort"
        value={data.effort}
        options={EFFORTS}
        onChange={(effort) => onChange({ effort })}
      />
    </div>
  )
}
