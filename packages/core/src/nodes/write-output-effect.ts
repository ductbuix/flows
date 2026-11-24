import type { DocumentStore } from "../ports/document-store.ts"
import type { EffectResult, RunEffect, RunState } from "../runs/model.ts"
import { latestStep } from "../runs/model.ts"

export type WriteOutputEffectDeps = {
  docs: DocumentStore
  runDirOf: (state: RunState) => string
}

/**
 * Folder output: copy each upstream step folder into run `output/` (DES-034).
 */
export function runWriteOutputEffect(
  effect: Extract<RunEffect, { kind: "write_output" }>,
  state: RunState,
  deps: WriteOutputEffectDeps
): EffectResult {
  const runDir = deps.runDirOf(state)
  const outputs: string[] = []
  for (const fromId of effect.from) {
    const pass = latestStep(state.steps, fromId)?.pass ?? 1
    const base = `${runDir}/nodes/${fromId}/pass-${pass}`
    const destRoot = `${runDir}/output/${fromId}`
    for (const path of deps.docs.list(`${base}/**`)) {
      if (!path.startsWith(`${base}/`)) continue
      const rel = path.slice(base.length + 1)
      if (!rel || rel.endsWith("/")) continue
      const body = deps.docs.read(path)?.text ?? ""
      deps.docs.write(`${destRoot}/${rel}`, body)
      outputs.push(`output/${fromId}/${rel}`)
    }
  }
  return { ok: true, outputs }
}
