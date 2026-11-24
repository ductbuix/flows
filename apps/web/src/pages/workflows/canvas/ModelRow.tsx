import { EFFORTS, type Effort } from "@workspace/contracts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

type Opt = { value: string; label: string }

const CLIS: Opt[] = [
  { value: "claude", label: "Claude" },
  { value: "cursor", label: "Cursor" },
]
const MODELS: Opt[] = [
  { value: "default", label: "Default" },
  { value: "sonnet", label: "Sonnet" },
  { value: "opus", label: "Opus" },
  { value: "haiku", label: "Haiku" },
]
const EFFORT_OPTS: Opt[] = [
  { value: "default", label: "Default" },
  ...EFFORTS.map((e) => ({
    value: e,
    label: e.charAt(0).toUpperCase() + e.slice(1),
  })),
]

function Pick({
  value,
  options,
  onChange,
  grow,
  label,
  testId,
}: {
  value: string
  options: Opt[]
  onChange: (v: string) => void
  grow?: boolean
  label: string
  testId: string
}) {
  return (
    <Select
      value={value}
      items={options}
      onValueChange={(v) => v && onChange(v)}
    >
      <SelectTrigger
        aria-label={label}
        data-testid={testId}
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

export type ModelPatch = {
  cli?: "claude" | "cursor"
  model?: string
  effort?: Effort
}

/** CLI, model and effort on an agent / llm / judge card (WF-16). */
export function ModelRow({
  cli,
  model,
  effort,
  onChange,
}: {
  cli?: string
  model?: string
  effort?: string
  onChange: (patch: ModelPatch) => void
}) {
  return (
    <div className="-mx-2 flex items-center gap-0.5" data-testid="model-row">
      <Pick
        label="CLI"
        testId="model-row-cli"
        value={cli === "cursor" ? "cursor" : "claude"}
        options={CLIS}
        onChange={(v) => onChange({ cli: v as "claude" | "cursor" })}
      />
      <Pick
        grow
        label="Model"
        testId="model-row-model"
        value={model ?? "default"}
        options={MODELS}
        onChange={(v) => onChange({ model: v === "default" ? undefined : v })}
      />
      <Pick
        label="Effort"
        testId="model-row-effort"
        value={effort ?? "default"}
        options={EFFORT_OPTS}
        onChange={(v) =>
          onChange({
            effort: v === "default" ? undefined : (v as Effort),
          })
        }
      />
    </div>
  )
}
