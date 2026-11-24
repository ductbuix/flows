import type { z } from "zod"
import type { NodeKind, PortSpec, StepContext, StepEvent } from "./types.ts"

/** Registers how a kind runs on the new contract (DES-041). */
export function defineNodeKind<S>(def: {
  kind: string
  settings: z.ZodType<S>
  ports: { in: PortSpec[]; out: PortSpec[] }
  execute(ctx: StepContext<S>): AsyncIterable<StepEvent>
}): NodeKind<S> {
  return def
}
