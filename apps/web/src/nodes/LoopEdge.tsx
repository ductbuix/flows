import {
  BaseEdge,
  EdgeLabelRenderer,
  type Edge,
  type EdgeProps,
} from "@xyflow/react"
import { Badge } from "@workspace/ui/components/badge"
import { branchLabel } from "./NodeFrame"

export type LoopEdgeData = { branch?: string }

/** How far below the nodes a loop edge swings. */
const SWING = 150

/**
 * A loop edge (DES-034, Loops): it leaves the source, swings under the
 * nodes and comes back into the target, so it never hides behind a forward
 * edge. A Badge says Loop, after the branch label when there is one.
 */
export function LoopEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
}: EdgeProps<Edge<LoopEdgeData>>) {
  const low = Math.max(sourceY, targetY) + SWING
  const path = `M ${sourceX} ${sourceY} C ${sourceX + 90} ${low}, ${targetX - 90} ${low}, ${targetX} ${targetY}`
  // Point of the curve at t = 0.5.
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 8 + (6 * low) / 8
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ strokeDasharray: "6 4" }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute flex items-center gap-1"
          style={{
            transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)`,
          }}
        >
          {data?.branch ? (
            <span className="text-xs text-muted-foreground">
              {branchLabel(data.branch)}
            </span>
          ) : null}
          <Badge variant="secondary" data-testid={`loop-badge-${id}`}>
            Loop
          </Badge>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const edgeTypes = { loop: LoopEdge }
