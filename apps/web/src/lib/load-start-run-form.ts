import {
  inputsJsonSchema,
  workflowDetailSchema,
  type WorkflowInputDecl,
} from "@workspace/shared"
import { api } from "@/lib/api"

export type StartRunTarget =
  | { mode: "start"; workflowId: string }
  | { mode: "rerun"; runId: string; workflowId: string }

export type StartRunDraft = {
  values: Record<string, string>
  files: { field: string; file: File }[]
}

export type StartRunFormData = {
  decls: WorkflowInputDecl[]
  values: Record<string, string>
  files: { field: string; file: File }[]
}

function inputFileUrl(runId: string, relPath: string): string {
  const segments = relPath.split("/").map(encodeURIComponent).join("/")
  return `${window.location.origin}/api/runs/${encodeURIComponent(runId)}/input/files/${segments}?download=1`
}

async function blobToFile(res: Response, name: string): Promise<File> {
  const blob = await res.blob()
  return new File([blob], name, {
    type: blob.type || "application/octet-stream",
  })
}

export async function loadStartRunForm(
  target: StartRunTarget
): Promise<StartRunFormData | { error: string }> {
  const wfRes = await api.workflows[":workflowId"].$get({
    param: { workflowId: target.workflowId },
  })
  if (!wfRes.ok) {
    return { error: `Workflow failed (${wfRes.status})` }
  }
  const detail = workflowDetailSchema.parse(await wfRes.json())
  const decls = detail.workflow?.inputs ?? []
  const values: Record<string, string> = {}
  const files: { field: string; file: File }[] = []

  for (const decl of decls) {
    if (decl.default !== undefined) values[decl.name] = decl.default
  }

  if (target.mode !== "rerun") {
    return { decls, values, files }
  }

  const metaRes = await api.runs[":runId"].input.meta.$get({
    param: { runId: target.runId },
  })
  if (!metaRes.ok) {
    return { error: `Run input meta failed (${metaRes.status})` }
  }
  const meta = inputsJsonSchema.parse(await metaRes.json())

  for (const decl of decls) {
    const field = meta.fields[decl.name]
    if (!field) continue
    if (field.type === "text" || field.type === "markdown") {
      values[decl.name] = field.value
      continue
    }
    const fileRes = await fetch(inputFileUrl(target.runId, field.path))
    if (!fileRes.ok) continue
    const base = field.path.split("/").pop() ?? decl.name
    files.push({
      field: decl.name,
      file: await blobToFile(fileRes, base),
    })
  }

  if (decls.length === 0) {
    for (const [key, field] of Object.entries(meta.fields)) {
      if (field.type !== "file") continue
      if (!key.startsWith("attach/")) continue
      const fileRes = await fetch(inputFileUrl(target.runId, field.path))
      if (!fileRes.ok) continue
      const base = field.path.split("/").pop() ?? "attach"
      files.push({
        field: "attach",
        file: await blobToFile(fileRes, base),
      })
    }
  }

  return { decls, values, files }
}
