import { z } from "zod"

export type PortType = "text" | "file"

export type NodeGroup = "inputs" | "steps" | "flow"

export type NodeKindDef<K extends string, S extends z.ZodRawShape> = {
  kind: K
  group: NodeGroup
  ports: { in: readonly PortType[]; out: readonly PortType[] }
  /** Branch names on edges out of this kind (Judge only, later). */
  branches?: readonly string[]
  /** Fixed node files and which are required (DES-033). */
  files: readonly { path: string; required: boolean }[]
  process: "none" | "cli" | "shell"
  answers: boolean
  settings: S
  /** Strict node schema: common keys plus the kind's settings. */
  schema: z.ZodObject<
    {
      id: z.ZodString
      kind: z.ZodLiteral<K>
      name: z.ZodOptional<z.ZodString>
    } & S,
    z.core.$strict
  >
}

/** Node ids are single path segments, safe as folder names (DES-033). */
export const nodeIdSchema = z
  .string()
  .min(1)
  .refine(
    (id) => !id.startsWith(".") && !/[/\\]/.test(id),
    "node id must be a single path segment"
  )

export function defineNodeKind<K extends string, S extends z.ZodRawShape>(def: {
  kind: K
  group: NodeGroup
  ports: { in: readonly PortType[]; out: readonly PortType[] }
  branches?: readonly string[]
  files?: readonly { path: string; required: boolean }[]
  process?: "none" | "cli" | "shell"
  answers?: boolean
  settings: S
}): NodeKindDef<K, S> {
  return {
    kind: def.kind,
    group: def.group,
    ports: def.ports,
    branches: def.branches,
    files: def.files ?? [],
    process: def.process ?? "none",
    answers: def.answers ?? false,
    settings: def.settings,
    schema: z.strictObject({
      id: nodeIdSchema,
      kind: z.literal(def.kind),
      name: z.string().optional(),
      ...def.settings,
    }),
  }
}
