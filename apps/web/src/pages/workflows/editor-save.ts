import type { LayoutFile } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { saveWorkflowLayout, saveWorkflowYaml } from "./workflow-actions"

export type SaveOutcome =
  | { kind: "ok"; hash?: string; layout?: LayoutFile }
  | { kind: "conflict" }
  | { kind: "validation"; messages: string[] }
  | { kind: "error"; message: string }

/** Validate (when yaml dirty) then save yaml and/or layout. */
export async function saveEditor(opts: {
  client: FlowsClient
  id: string
  yaml: string
  baseHash: string
  yamlDirty: boolean
  layoutDirty: boolean
  layoutDraft: LayoutFile | null
}): Promise<SaveOutcome> {
  const { client, id, yaml, baseHash, yamlDirty, layoutDirty, layoutDraft } =
    opts
  let hash: string | undefined
  if (yamlDirty) {
    const check = await client.call("workflow/validate", { yaml })
    if (check.errors.length > 0) {
      return {
        kind: "validation",
        messages: check.errors.map((e) => e.message),
      }
    }
    const result = await saveWorkflowYaml(client, id, yaml, baseHash)
    if (result === "conflict") return { kind: "conflict" }
    if (typeof result === "string") return { kind: "error", message: result }
    hash = result.hash
  }
  let layout: LayoutFile | undefined
  if (layoutDirty && layoutDraft) {
    const result = await saveWorkflowLayout(client, id, layoutDraft)
    if (typeof result === "string") return { kind: "error", message: result }
    layout = result.layout
  }
  return { kind: "ok", hash, layout }
}
