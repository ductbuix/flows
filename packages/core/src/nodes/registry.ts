import type { NodeKind } from "./types.ts"

/** Lookup of NodeKind by kind key (DES-035 / DES-041). */
export class NodeKindRegistry {
  private readonly byKind = new Map<string, NodeKind>()

  register(kind: NodeKind): this {
    this.byKind.set(kind.kind, kind)
    return this
  }

  get(kind: string): NodeKind | undefined {
    return this.byKind.get(kind)
  }

  kinds(): string[] {
    return [...this.byKind.keys()]
  }
}

export function createNodeKindRegistry(
  kinds: readonly NodeKind[] = []
): NodeKindRegistry {
  const registry = new NodeKindRegistry()
  for (const k of kinds) registry.register(k)
  return registry
}

/**
 * Registry key for a workflow node. Output notify/publish map to kinds
 * (DES-041 table); folder stays `write_output` on the effect runner.
 * Contracts still say `judge`; rule mode (default) runs the ACP
 * `condition` kind. Check mode stays on `judge`.
 */
export function kindKeyForNode(node: {
  kind: string
  target?: string
  mode?: string
}): string | undefined {
  if (node.kind === "output" && node.target === "notify") return "notify"
  if (node.kind === "output" && node.target === "publish") return "publish"
  if (node.kind === "output") return undefined
  if (node.kind === "judge") {
    return node.mode === "check" ? "judge" : "condition"
  }
  return node.kind
}
