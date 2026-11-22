import { join } from "node:path"

/** Step folder of one pass of one node (DES-033). */
export function stepDir(
  runRoot: string,
  nodeId: string,
  pass: number
): string {
  return join(runRoot, "nodes", nodeId, `pass-${pass}`)
}

/** Node files frozen at run start, so a run never reads live edits. */
export function frozenDir(runRoot: string, nodeId: string): string {
  return join(runRoot, "nodes", nodeId, "frozen")
}

/** Posix path relative to the run folder, as stored in `outputs`. */
export function relOut(...parts: string[]): string {
  return parts.join("/")
}
