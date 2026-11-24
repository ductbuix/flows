import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Panel } from "@xyflow/react"
import type { WorkflowNode } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { KIND_LABEL } from "./flow-kinds"
import {
  AllowLists,
  StepLimits,
  SystemPromptField,
} from "./node-settings-fields"
import {
  ApprovalSettings,
  OutputSettings,
  TriggerSettings,
} from "./node-settings-kinds"

type Patch = Record<string, unknown>

type Props = {
  node: WorkflowNode
  systemPrompt?: string
  onSystemPrompt?: (text: string) => void
  onChange: (patch: Patch) => void
  onClose: () => void
}

function settingsBody(
  node: WorkflowNode,
  onChange: (patch: Patch) => void,
  systemPrompt: string | undefined,
  onSystemPrompt: ((text: string) => void) | undefined
): ReactNode {
  switch (node.kind) {
    case "llm":
      return (
        <>
          {onSystemPrompt ? (
            <SystemPromptField
              value={systemPrompt ?? ""}
              onChange={onSystemPrompt}
            />
          ) : null}
          <StepLimits node={node} onChange={onChange} />
          <AllowLists
            connectors={node.connectors ?? []}
            skills={node.skills ?? []}
            onChange={onChange}
          />
        </>
      )
    case "agent":
      return (
        <>
          <StepLimits node={node} onChange={onChange} />
          <AllowLists
            connectors={node.connectors ?? []}
            skills={node.skills ?? []}
            onChange={onChange}
          />
        </>
      )
    case "judge":
    case "command":
      return <StepLimits node={node} onChange={onChange} />
    case "approval":
      return <ApprovalSettings node={node} onChange={onChange} />
    case "output":
      return <OutputSettings node={node} onChange={onChange} />
    case "trigger":
      return <TriggerSettings node={node} onChange={onChange} />
    default:
      return (
        <p className="text-sm text-muted-foreground">
          No extra settings for this kind.
        </p>
      )
  }
}

/** Advanced settings of the selected node (WF-12, WF-14, WF-15). */
export function NodeSettings({
  node,
  systemPrompt,
  onSystemPrompt,
  onChange,
  onClose,
}: Props) {
  const body = settingsBody(node, onChange, systemPrompt, onSystemPrompt)
  return (
    <Panel position="top-right" style={{ top: 64 }}>
      <div
        className="flex w-80 flex-col gap-4 overflow-y-auto rounded-3xl bg-card p-4 ring-1 ring-foreground/10"
        style={{ maxHeight: "calc(100vh - 14rem)" }}
        data-testid="node-settings"
      >
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="font-heading text-base font-medium">
              {KIND_LABEL[node.kind]} settings
            </h2>
            <span className="truncate text-xs text-muted-foreground">
              {node.id}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close settings"
            data-testid="node-settings-close"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        {body}
      </div>
    </Panel>
  )
}
