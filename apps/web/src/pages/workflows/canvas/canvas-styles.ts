import type { CSSProperties } from "react"
import type { DefaultEdgeOptions } from "@xyflow/react"

/** Style of an edge that is selected on the workflow canvas. */
export const SELECTED_EDGE = { stroke: "var(--ring)", strokeWidth: 2 }

export const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  type: "smoothstep",
  style: {
    strokeDasharray: "6 6",
    stroke: "var(--muted-foreground)",
  },
}

/** Line drawn while the user drags a new wire. */
export const CONNECTION_LINE_STYLE: CSSProperties = {
  stroke: "var(--ring)",
  strokeWidth: 2,
  strokeDasharray: "6 6",
}
