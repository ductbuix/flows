import { Handle, Position, useNodeConnections } from "@xyflow/react"
import { File, Plus, Type } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export const PORT_STYLE = {
  text: "text-info ring-info/50",
  file: "text-warning ring-warning/50",
  any: "text-foreground ring-foreground/30",
}

/** Fill once a wire is attached. */
const PORT_LINKED = {
  text: "bg-info/20!",
  file: "bg-warning/20!",
  any: "bg-muted!",
}

type Port = keyof typeof PORT_STYLE

type PortProps = {
  io: "in" | "out"
  port?: Port
  id?: string
  /** Position on the edge: index of `count` ports, spread evenly. */
  index?: number
  count?: number
  /** Extra offset when the port sits inside a padded row (Judge). */
  inset?: number
}

/**
 * Typed connection point centred on the card edge: T for text, file icon
 * for file. Drag from an out port to an in port of the same type.
 */
export function PortHandle({
  io,
  port = "text",
  id,
  index = 0,
  count = 1,
  inset = 0,
}: PortProps) {
  const Icon = port === "text" ? Type : port === "file" ? File : Plus
  const handleId = id ?? port
  const linked =
    useNodeConnections({
      handleType: io === "in" ? "target" : "source",
      handleId,
    }).length > 0
  const side = io === "in" ? "left" : "right"
  return (
    <Handle
      id={handleId}
      type={io === "in" ? "target" : "source"}
      position={io === "in" ? Position.Left : Position.Right}
      title={`${port === "file" ? "Files" : "Text"} ${io === "in" ? "in" : "out"}`}
      style={{
        top: `${((index + 1) * 100) / (count + 1)}%`,
        [side]: -inset,
      }}
      className={cn(
        "z-10 flex size-5! items-center justify-center rounded-full! border-0! bg-card! ring-1 transition-transform hover:scale-125",
        PORT_STYLE[port],
        linked && PORT_LINKED[port]
      )}
    >
      <Icon className="pointer-events-none size-2.5" />
    </Handle>
  )
}

/** In and out ports of a kind, spread along the card edges. */
export function KindPorts({
  ins,
  outs,
}: {
  ins: readonly Port[]
  outs: readonly Port[]
}) {
  return (
    <>
      {ins.map((port, i) => (
        <PortHandle
          key={`in-${port}`}
          io="in"
          port={port}
          index={i}
          count={ins.length}
        />
      ))}
      {outs.map((port, i) => (
        <PortHandle
          key={`out-${port}`}
          io="out"
          port={port}
          index={i}
          count={outs.length}
        />
      ))}
    </>
  )
}
