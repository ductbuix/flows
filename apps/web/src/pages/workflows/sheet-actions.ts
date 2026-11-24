import {
  setNodeKey,
  setWorkflowField,
  type WorkflowInputDecl,
} from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { errorMessage, isConflictError } from "@/lib/fcp-error"

export type SheetActionResult = "ok" | "conflict" | string

/** Display name on the sheet (id stays put). */
export async function renameWorkflowName(
  client: FlowsClient,
  id: string,
  name: string
): Promise<SheetActionResult> {
  try {
    const detail = await client.call("workflow/get", { id })
    const yaml = setWorkflowField(detail.yaml, "name", name.trim() || undefined)
    await client.call("workflow/save", {
      id,
      yaml,
      baseHash: detail.hash,
    })
    return "ok"
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}

/** Folder id rename via workflow/rename. */
export async function renameWorkflowId(
  client: FlowsClient,
  id: string,
  newId: string
): Promise<SheetActionResult> {
  try {
    await client.call("workflow/rename", {
      id,
      newId,
      requestKey: crypto.randomUUID(),
    })
    return "ok"
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}

/** Persist trigger inputs a card must supply. */
export async function saveWorkflowInputs(
  client: FlowsClient,
  id: string,
  triggerId: string,
  inputs: WorkflowInputDecl[]
): Promise<SheetActionResult> {
  try {
    const detail = await client.call("workflow/get", { id })
    const yaml = setNodeKey(
      detail.yaml,
      triggerId,
      "inputs",
      inputs.length > 0 ? inputs : undefined
    )
    await client.call("workflow/save", {
      id,
      yaml,
      baseHash: detail.hash,
    })
    return "ok"
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}
