import type { NodeKindName, Workflow, WorkflowNode } from "@workspace/contracts"
import type { RunSummary, WireCardFace } from "@workspace/contracts"
import { Background, BackgroundVariant } from "@xyflow/react"
import { CanvasToolbar } from "./CanvasToolbar"
import { NodeSettings } from "./NodeSettings"
import { RunBar } from "./RunBar"

type History = {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

type Props = {
  workflow: Workflow
  editing: WorkflowNode | undefined
  systemText: string
  saveSystem: (id: string, text: string) => void | Promise<void>
  onUpdate: (id: string, patch: Record<string, unknown>) => void
  onCloseSettings: () => void
  readOnly: boolean
  runs: RunSummary[]
  cards: WireCardFace[]
  runView: string
  cardId: string | null
  onRunView: (v: string) => void
  onCard: (v: string) => void
  onStart: () => void
  viewing: RunSummary | null
  starting?: boolean
  history: History
  onAdd: (kind: NodeKindName) => void
}

/** Panels layered on the React Flow canvas. */
export function CanvasChrome({
  workflow,
  editing,
  systemText,
  saveSystem,
  onUpdate,
  onCloseSettings,
  readOnly,
  runs,
  cards,
  runView,
  cardId,
  onRunView,
  onCard,
  onStart,
  viewing,
  starting,
  history,
  onAdd,
}: Props) {
  return (
    <>
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        color="var(--muted-foreground)"
      />
      {editing ? (
        <NodeSettings
          key={editing.id}
          node={editing}
          systemPrompt={systemText}
          onSystemPrompt={
            editing.kind === "llm"
              ? (text) => void saveSystem(editing.id, text)
              : undefined
          }
          onChange={(patch) => onUpdate(editing.id, patch)}
          onClose={onCloseSettings}
        />
      ) : null}
      <RunBar
        runs={runs}
        cards={cards}
        value={readOnly ? runView : "draft"}
        cardId={cardId}
        onValue={onRunView}
        onCard={onCard}
        onStart={onStart}
        viewing={viewing}
        starting={starting}
      />
      {!readOnly ? (
        <CanvasToolbar
          hasTrigger={workflow.nodes.some((n) => n.kind === "trigger")}
          onAdd={onAdd}
          history={history}
        />
      ) : null}
    </>
  )
}
