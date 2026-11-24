import type { ReactNode } from "react"
import type { WorkflowNode } from "@workspace/contracts"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { ConnectorList, SkillList } from "./StepConnectors"

type Opt = { value: string; label: string }

export const TIMEOUT_OPTS: Opt[] = ["1", "5", "15", "30", "60"].map((m) => ({
  value: m,
  label: `${m} min`,
}))
export const RETRY_OPTS: Opt[] = ["0", "1", "2", "3"].map((n) => ({
  value: n,
  label: n === "0" ? "No retry" : `${n} ${n === "1" ? "retry" : "retries"}`,
}))

export function Choice({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string
  value: string
  options: Opt[]
  onChange: (v: string) => void
  testId?: string
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        value={value}
        items={options}
        onValueChange={(v) => v && onChange(v)}
      >
        <SelectTrigger aria-label={label} data-testid={testId}>
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
    </Field>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  )
}

export function timeoutMin(node: WorkflowNode): string {
  const sec = "timeout" in node ? node.timeout : undefined
  if (typeof sec !== "number") return "15"
  return String(Math.max(1, Math.round(sec / 60)))
}

export function retryMax(node: WorkflowNode): string {
  const r = "retry" in node ? node.retry : undefined
  return r && typeof r === "object" && "max" in r ? String(r.max) : "0"
}

type Patch = Record<string, unknown>

export function StepLimits({
  node,
  onChange,
}: {
  node: WorkflowNode
  onChange: (patch: Patch) => void
}) {
  return (
    <>
      <Choice
        label="Time limit"
        value={timeoutMin(node)}
        options={TIMEOUT_OPTS}
        testId="node-settings-timeout"
        onChange={(m) => onChange({ timeout: Number(m) * 60 })}
      />
      <Choice
        label="If it fails"
        value={retryMax(node)}
        options={RETRY_OPTS}
        testId="node-settings-retry"
        onChange={(n) =>
          onChange({ retry: n === "0" ? undefined : { max: Number(n) } })
        }
      />
    </>
  )
}

export function AllowLists({
  connectors,
  skills,
  onChange,
}: {
  connectors: string[]
  skills: string[]
  onChange: (patch: Patch) => void
}) {
  return (
    <>
      <Separator className="my-1" />
      <div className="flex flex-col gap-4">
        <Section title="Connectors" hint="Systems this step may read or change.">
          <ConnectorList
            value={connectors}
            onChange={(next) =>
              onChange({ connectors: next.length === 0 ? undefined : next })
            }
          />
        </Section>
        <Section title="Skills" hint="Instructions the step may follow.">
          <SkillList
            value={skills}
            onChange={(next) =>
              onChange({ skills: next.length === 0 ? undefined : next })
            }
          />
        </Section>
      </div>
    </>
  )
}

export function SystemPromptField({
  value,
  onChange,
}: {
  value: string
  onChange: (text: string) => void
}) {
  return (
    <Field>
      <FieldLabel>System prompt</FieldLabel>
      <Textarea
        aria-label="System prompt"
        rows={4}
        placeholder="Optional: how the model should behave"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid="node-settings-system-prompt"
      />
    </Field>
  )
}
