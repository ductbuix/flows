import { Panel, useReactFlow } from "@xyflow/react"
import { Redo2, Scan, Undo2 } from "lucide-react"
import type { NodeKindName } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { AddNodeMenu } from "./AddNodeMenu"

type History = {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

type Props = {
  hasTrigger: boolean
  onAdd: (kind: NodeKindName) => void
  history: History
}

/** Bottom toolbar: undo, redo, fit view, add node (BL-202). */
export function CanvasToolbar({ hasTrigger, onAdd, history }: Props) {
  const { fitView } = useReactFlow()
  return (
    <Panel position="bottom-center">
      <div
        className="flex items-center gap-2 rounded-3xl bg-card p-2 ring-1 ring-foreground/10"
        data-testid="workflow-canvas-toolbar"
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Undo"
          data-testid="workflow-canvas-undo"
          disabled={!history.canUndo}
          onClick={history.undo}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Redo"
          data-testid="workflow-canvas-redo"
          disabled={!history.canRedo}
          onClick={history.redo}
        >
          <Redo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Fit view"
          data-testid="workflow-canvas-fit"
          onClick={() => void fitView({ maxZoom: 0.8, duration: 200 })}
        >
          <Scan />
        </Button>
        <AddNodeMenu hasTrigger={hasTrigger} onPick={onAdd} />
      </div>
    </Panel>
  )
}
