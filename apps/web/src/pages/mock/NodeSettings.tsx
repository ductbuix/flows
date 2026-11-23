import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Panel } from "@xyflow/react"
import { Button } from "@workspace/ui/components/button"
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
import { KIND_LABEL, type FlowData, type FlowNode } from "./flow-data"
import { ConnectorList, SkillList } from "./StepConnectors"
import { TriggerInputs } from "./TriggerInputs"

type Opt = { value: string; label: string }

const TIMEOUT: Opt[] = ["1", "5", "15", "30", "60"].map((m) => ({ value: m, label: `${m} min` }))
const RETRIES: Opt[] = ["0", "1", "2", "3"].map((n) => ({ value: n, label: n === "0" ? "No retry" : `${n} ${n === "1" ? "retry" : "retries"}` }))
const FORMAT: Opt[] = [{ value: "text", label: "Plain text" }, { value: "markdown", label: "Markdown" }, { value: "json", label: "JSON" }]
const UNSURE: Opt[] = [{ value: "no", label: "Answer No" }, { value: "yes", label: "Answer Yes" }, { value: "ask", label: "Ask me" }]
const REJECT: Opt[] = [{ value: "never", label: "Never" }, { value: "1h", label: "After 1 hour" }, { value: "24h", label: "After 24 hours" }]
const CHANNEL: Opt[] = [{ value: "app", label: "In the app" }, { value: "system", label: "System notification" }]

function Choice({ label, value, options, onChange }: { label: string; value?: string; options: Opt[]; onChange: (v: string) => void }) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value ?? options[0]!.value} items={options} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger aria-label={label}>
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

function Text({ label, value, placeholder, onChange }: { label: string; value?: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Textarea aria-label={label} rows={4} placeholder={placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
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

type Props = {
  node: FlowNode
  inputs: string[]
  onInputs: (inputs: string[]) => void
  onChange: (patch: Partial<FlowData>) => void
  onClose: () => void
}

/** Advanced settings of the selected node, beside the canvas. */
export function NodeSettings({ node, inputs, onInputs, onChange, onClose }: Props) {
  const d = node.data
  let body: ReactNode = null
  switch (node.type) {
    case "llm":
    case "condition":
      body = (
        <>
          <Text label="System prompt" placeholder="Optional: how the model should behave" value={d.systemPrompt} onChange={(systemPrompt) => onChange({ systemPrompt })} />
          <Choice label="Time limit" value={d.timeout ?? "15"} options={TIMEOUT} onChange={(timeout) => onChange({ timeout })} />
          <Choice label="If it fails" value={d.retries} options={RETRIES} onChange={(retries) => onChange({ retries })} />
          {node.type === "llm" ? (
            <>
              <Choice label="Output format" value={d.format} options={FORMAT} onChange={(format) => onChange({ format })} />
              <Separator className="my-1" />
              <div className="flex flex-col gap-4">
                <Section title="Connectors" hint="Systems this step may read or change.">
                  <ConnectorList value={d.connectors ?? []} onChange={(connectors) => onChange({ connectors })} />
                </Section>
                <Section title="Skills" hint="Instructions the step may follow.">
                  <SkillList value={d.skills ?? []} onChange={(skills) => onChange({ skills })} />
                </Section>
              </div>
            </>
          ) : (
            <Choice label="If unsure" value={d.ifUnsure} options={UNSURE} onChange={(ifUnsure) => onChange({ ifUnsure })} />
          )}
        </>
      )
      break
    case "approval":
      body = <Choice label="Auto-reject" value={d.autoReject} options={REJECT} onChange={(autoReject) => onChange({ autoReject })} />
      break
    case "notify":
      body = (
        <>
          <Choice label="Show" value={d.channel} options={CHANNEL} onChange={(channel) => onChange({ channel })} />
          <Text label="Message" placeholder="Optional text under the title" value={d.body} onChange={(b) => onChange({ body: b })} />
        </>
      )
      break
    case "asset":
      body = <Text label="Description for the AI" placeholder="What this file is and how to use it" value={d.description} onChange={(description) => onChange({ description })} />
      break
    case "trigger":
      body = (
        <Field>
          <FieldLabel>Inputs a card supplies</FieldLabel>
          <TriggerInputs inputs={inputs} onChange={onInputs} />
        </Field>
      )
  }
  return (
    <Panel position="top-right" style={{ top: 64 }}>
      <div
        className="flex w-80 flex-col gap-4 overflow-y-auto rounded-3xl bg-card p-4 ring-1 ring-foreground/10"
        style={{ maxHeight: "calc(100vh - 14rem)" }}
        data-testid="node-settings"
      >
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="font-heading text-base font-medium">{KIND_LABEL[node.type!]} settings</h2>
            <span className="truncate text-xs text-muted-foreground">{node.id}</span>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close settings" onClick={onClose}>
            <X />
          </Button>
        </div>
        {body}
      </div>
    </Panel>
  )
}
