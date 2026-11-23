import { Check, X, FileText, Library, Image as ImageIcon, MousePointerClick, Bell, Play } from "lucide-react"
import { Link } from "react-router"
import { useNodeConnections, type NodeProps } from "@xyflow/react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import { useFlow } from "./flow-context"
import type { FlowNode } from "./flow-data"
import { findLibraryFile, LibraryFilePicker } from "./LibraryFilePicker"
import { useLibrary } from "./library-store"
import { BARE_INPUT, FIELD, NodeShell, PortHandle } from "./NodeShell"

/** The one start of a workflow; only a manual trigger exists so far. */
export function TriggerNode({ data, selected }: NodeProps<FlowNode>) {
  const { runAll, readOnly } = useFlow()
  return (
    <NodeShell kind="trigger" selected={selected} state={data.state}>
      <div className={cn(FIELD, "flex items-center gap-2 text-sm font-medium")}>
        <MousePointerClick className="size-4 text-warning" />
        Manual
      </div>
      {readOnly ? null : (
        <Button className="nodrag w-full" onClick={runAll}>
          Run workflow
          <Play />
        </Button>
      )}
      <PortHandle io="out" port="text" />
    </NodeShell>
  )
}

/** One output type. No inputs: a file from the Library. With inputs: made by the flow. */
export function AssetNode({ id, data, selected }: NodeProps<FlowNode>) {
  const { update } = useFlow()
  const inputs = useNodeConnections({ handleType: "target" }).length
  const image = data.assetKind !== "markdown"
  const Icon = image ? ImageIcon : FileText
  const found = findLibraryFile(useLibrary(), data.name ?? "")
  return (
    <NodeShell kind="asset" selected={selected} state={data.state}>
      <PortHandle io="in" port="any" />
      <div className="flex h-28 flex-col items-center justify-center gap-2 rounded-2xl bg-muted/60 text-muted-foreground">
        <Icon className="size-8" />
        {inputs === 0 && found ? (
          <span className="max-w-full truncate px-3 text-xs">{found.file.name.split("/").pop()}</span>
        ) : null}
      </div>
      {inputs > 0 ? (
        <div className={FIELD}>
          <Input
            aria-label="File name"
            placeholder="Name of the file to make"
            className={BARE_INPUT}
            value={data.name ?? ""}
            onChange={(e) => update(id, { name: e.target.value })}
          />
          <p className="pt-1 text-xs text-muted-foreground">
            Made from {inputs} {inputs === 1 ? "input" : "inputs"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <LibraryFilePicker
            kind={image ? "image" : "markdown"}
            value={data.name ?? ""}
            onChange={(name) => update(id, { name })}
          />
          {found ? (
            <Link
              to={`/mock/library?item=${found.item.id}`}
              className="nodrag flex items-center gap-1 px-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Library className="size-3" />
              <span className="truncate">{found.item.title}</span>
              <span className="shrink-0">· v{found.item.current}</span>
            </Link>
          ) : (
            <p className="px-1 text-xs text-muted-foreground">Pick a file from the Library</p>
          )}
        </div>
      )}
      <ToggleGroup
        className="nodrag w-full"
        value={[image ? "image" : "markdown"]}
        onValueChange={(v) =>
          v[0] && update(id, { assetKind: v[0] as "image" | "markdown", name: "" })
        }
      >
        <ToggleGroupItem className="flex-1" value="image">Image</ToggleGroupItem>
        <ToggleGroupItem className="flex-1" value="markdown">Markdown</ToggleGroupItem>
      </ToggleGroup>
      <PortHandle io="out" id="out" port={image ? "image" : "text"} />
    </NodeShell>
  )
}

/** Pauses the run until a person approves or rejects. */
export function ApprovalNode({ id, data, selected }: NodeProps<FlowNode>) {
  const { update, decide } = useFlow()
  return (
    <NodeShell kind="approval" selected={selected} state={data.state}>
      <PortHandle io="in" port="text" />
      <div className={FIELD}>
        <Input
          aria-label="Question"
          placeholder="Ask me before continuing"
          className={BARE_INPUT}
          value={data.question ?? ""}
          onChange={(e) => update(id, { question: e.target.value })}
        />
      </div>
      {data.state === "waiting" && decide ? (
        <div className="pointer-events-auto flex gap-2" data-testid={`node-decide-${id}`}>
          <Button className="nodrag flex-1" onClick={() => decide("approved")}>
            <Check />
            Approve
          </Button>
          <Button variant="outline" className="nodrag flex-1" onClick={() => decide("rejected")}>
            <X />
            Reject
          </Button>
        </div>
      ) : null}
      <PortHandle io="out" port="text" />
    </NodeShell>
  )
}

/** Ends a branch by telling the user. */
export function OutputNode({ id, data, selected }: NodeProps<FlowNode>) {
  const { update, run, readOnly } = useFlow()
  return (
    <NodeShell kind="notify" selected={selected} state={data.state}>
      <PortHandle io="in" port="text" />
      <div className={cn(FIELD, "flex flex-col gap-2")}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bell className="size-4 text-info" />
          Notification
        </div>
        <Input
          aria-label="Title"
          placeholder="Title"
          className={BARE_INPUT}
          value={data.title ?? ""}
          onChange={(e) => update(id, { title: e.target.value })}
        />
      </div>
      {readOnly ? null : (
        <Button className="nodrag w-full" onClick={() => run(id)}>
          Run
          <Play />
        </Button>
      )}
    </NodeShell>
  )
}
