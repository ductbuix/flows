import { useReactFlow, Panel } from "@xyflow/react"
import { Redo2, Scan, Undo2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { AddNodeMenu } from "./AddNodeMenu"
import type { NodeKind } from "./flow-data"

export function Toolbar({
  hasTrigger,
  onAdd,
  history,
}: {
  hasTrigger: boolean
  onAdd: (kind: NodeKind) => void
  history: {
    undo: () => void
    redo: () => void
    canUndo: boolean
    canRedo: boolean
  }
}) {
  const { fitView } = useReactFlow()
  return (
    <Panel position="bottom-center">
      <div className="flex items-center gap-2 rounded-3xl bg-card p-2 ring-1 ring-foreground/10">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Undo"
          disabled={!history.canUndo}
          onClick={history.undo}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Redo"
          disabled={!history.canRedo}
          onClick={history.redo}
        >
          <Redo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Fit view"
          onClick={() => void fitView({ maxZoom: 0.8, duration: 200 })}
        >
          <Scan />
        </Button>
        <AddNodeMenu hasTrigger={hasTrigger} onPick={onAdd} />
      </div>
    </Panel>
  )
}
