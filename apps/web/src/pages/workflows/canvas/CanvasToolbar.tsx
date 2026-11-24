import { Panel, useReactFlow } from "@xyflow/react"
import { Scan } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

/**
 * Bottom toolbar. Fit view ships in BL-201; undo/redo and add-node land in
 * BL-202 in this same panel slot.
 */
export function CanvasToolbar() {
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
          aria-label="Fit view"
          data-testid="workflow-canvas-fit"
          onClick={() => void fitView({ maxZoom: 0.8, duration: 200 })}
        >
          <Scan />
        </Button>
      </div>
    </Panel>
  )
}
