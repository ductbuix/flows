import { Bell, MonitorSmartphone, MousePointerClick } from "lucide-react"
import type { NodeProps } from "@xyflow/react"
import { useQuery } from "@workspace/sdk-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useFlow } from "./flow-context"
import { NodeYamlField } from "./NodeFields"
import { FIELD, NodeShell } from "./NodeShell"
import { KindPorts } from "./NodePorts"
import { MultiPick } from "./MultiPick"
import { portsFor, type CanvasNode } from "./flow-graph"

type Props = NodeProps<CanvasNode>

function Ports({ kind }: { kind: string }) {
  const p = portsFor(kind)
  return <KindPorts ins={p.in} outs={p.out} />
}

/** Manual start of a workflow; nothing to set. */
export function TriggerNode({ data, selected }: Props) {
  return (
    <NodeShell
      kind="trigger"
      name={data.name}
      selected={selected}
      state={data.state}
      result={data.result}
    >
      <Ports kind="trigger" />
      <div className={cn(FIELD, "flex items-center gap-2 text-sm font-medium")}>
        <MousePointerClick className="size-4 text-warning" />
        Start by hand
      </div>
    </NodeShell>
  )
}

/** Library items whose current version feeds the next steps. */
export function AssetNode({ id, data, selected }: Props) {
  const { update, readOnly } = useFlow()
  const libQ = useQuery("library/list", {}, { topics: ["library"] })
  const options = (libQ.data?.items ?? []).map((i) => ({
    value: String(i.id),
    label: i.title,
    hint: `${i.kind} · v${i.current}`,
  }))
  const items = data.items ?? []
  return (
    <NodeShell
      kind="asset"
      name={data.name}
      wide
      selected={selected}
      state={data.state}
      result={data.result}
    >
      <Ports kind="asset" />
      {readOnly ? (
        <p className={cn(FIELD, "text-sm")}>
          {items.length === 0
            ? "No library items"
            : items
                .map((v) => options.find((o) => o.value === v)?.label ?? v)
                .join(", ")}
        </p>
      ) : (
        <MultiPick
          options={options}
          value={items}
          onChange={(next) =>
            update(id, { items: next.length === 0 ? undefined : next })
          }
          label="Library items"
          placeholder={
            options.length === 0 ? "Library is empty" : "Pick library items"
          }
          empty="No library item matches"
        />
      )}
    </NodeShell>
  )
}

/** Pauses until a person approves or rejects. */
export function ApprovalNode({ id, data, selected }: Props) {
  const { update } = useFlow()
  return (
    <NodeShell
      kind="approval"
      name={data.name}
      selected={selected}
      state={data.state}
      result={data.result}
    >
      <Ports kind="approval" />
      <NodeYamlField
        value={data.question ?? ""}
        label="Question"
        placeholder="Continue?"
        rows={2}
        testId="node-field-question"
        onCommit={(question) =>
          update(id, { question: question || "Continue?" })
        }
      />
    </NodeShell>
  )
}

const CHANNELS = [
  { value: "app", label: "In the app", icon: Bell },
  { value: "system", label: "System", icon: MonitorSmartphone },
] as const

/** Ends a branch with a notification in the app or from the system. */
export function OutputNode({ id, data, selected }: Props) {
  const { update, readOnly } = useFlow()
  const legacy = data.target !== undefined && data.target !== "notify"
  const channel = data.channel ?? "app"
  return (
    <NodeShell
      kind="output"
      name={data.name}
      selected={selected}
      state={data.state}
      result={data.result}
    >
      <Ports kind="output" />
      {legacy ? (
        <div className={cn(FIELD, "flex items-center gap-2 text-sm")}>
          <span className="flex-1 text-muted-foreground">
            {data.target === "folder" ? "Run folder" : "Publish"} output is
            retired
          </span>
          {!readOnly ? (
            <Button
              variant="outline"
              className="nodrag"
              data-testid="output-use-notify"
              onClick={() =>
                update(id, {
                  target: "notify",
                  connection: undefined,
                  latest: undefined,
                })
              }
            >
              Notify instead
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div
            className="nodrag grid grid-cols-2 gap-1 rounded-2xl bg-muted/60 p-1"
            role="radiogroup"
            aria-label="Notification"
          >
            {CHANNELS.map((c) => (
              <Button
                key={c.value}
                role="radio"
                aria-checked={channel === c.value}
                variant={channel === c.value ? "secondary" : "ghost"}
                className={cn(
                  channel === c.value && "bg-card ring-1 ring-foreground/10"
                )}
                disabled={readOnly}
                data-testid={`output-channel-${c.value}`}
                onClick={() =>
                  update(id, {
                    channel: c.value === "app" ? undefined : c.value,
                  })
                }
              >
                <c.icon />
                {c.label}
              </Button>
            ))}
          </div>
          <NodeYamlField
            value={data.title ?? ""}
            label="Title"
            placeholder="Notification title"
            rows={1}
            testId="node-field-title"
            onCommit={(title) => update(id, { title: title || undefined })}
          />
        </>
      )}
    </NodeShell>
  )
}
