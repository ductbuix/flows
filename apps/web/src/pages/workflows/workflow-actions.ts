import {
  setWorkflowField,
  type LayoutFile,
  type WorkflowSummary,
} from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { errorMessage, isConflictError } from "@/lib/fcp-error"

/** "Feature Spec!" becomes "feature-spec". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Pick an unused id from a name; appends -2, -3, … when taken. */
export function uniqueWorkflowId(
  name: string,
  existing: readonly WorkflowSummary[]
): string {
  const base = slugify(name).slice(0, 40) || "workflow"
  let id = base
  for (let n = 2; existing.some((w) => w.id === id); n++) id = `${base}-${n}`
  return id
}

export async function createWorkflow(
  client: FlowsClient,
  id: string,
  name: string,
  goal: string
): Promise<"ok" | "conflict" | string> {
  try {
    await client.call("workflow/create", { id, name, goal })
    return "ok"
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}

/** Updates display name and goal in workflow.yaml (id stays put). */
export async function updateWorkflowMeta(
  client: FlowsClient,
  id: string,
  name: string,
  goal: string
): Promise<"ok" | "conflict" | string> {
  try {
    const detail = await client.call("workflow/get", { id })
    let yaml = setWorkflowField(detail.yaml, "name", name)
    yaml = setWorkflowField(yaml, "goal", goal)
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

export async function deleteWorkflow(
  client: FlowsClient,
  id: string
): Promise<"ok" | string> {
  try {
    await client.call("workflow/delete", { id })
    return "ok"
  } catch (err) {
    return errorMessage(err)
  }
}

export async function saveWorkflowYaml(
  client: FlowsClient,
  id: string,
  yaml: string,
  baseHash: string
): Promise<{ ok: true; hash: string } | "conflict" | string> {
  try {
    const detail = await client.call("workflow/save", { id, yaml, baseHash })
    return { ok: true, hash: detail.hash }
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}

export async function saveWorkflowLayout(
  client: FlowsClient,
  id: string,
  layout: LayoutFile
): Promise<{ ok: true; layout: LayoutFile } | string> {
  try {
    const written = await client.call("workflow/save_layout", { id, layout })
    return { ok: true, layout: written }
  } catch (err) {
    return errorMessage(err)
  }
}
