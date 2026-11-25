import type { DocumentStore } from "../ports/document-store.ts"
import type { EffectResult, RunEffect, RunState } from "../runs/model.ts"
import { loadStepInputs } from "./context.ts"
import { resolveInputSources } from "./input-sources.ts"

export type WriteOutputEffectDeps = {
  docs: DocumentStore
  runDirOf: (state: RunState) => string
}

/**
 * Folder output: copy each upstream step's results into run `output/`
 * (DES-034). Results pass through Judge and Approval; logs never do.
 */
export function runWriteOutputEffect(
  effect: Extract<RunEffect, { kind: "write_output" }>,
  state: RunState,
  deps: WriteOutputEffectDeps
): EffectResult {
  const runDir = deps.runDirOf(state)
  const outputs: string[] = []
  const sources = resolveInputSources(state, effect.nodeId).filter(
    (s) => s.role === "result"
  )
  for (const input of loadStepInputs(deps.docs, runDir, sources)) {
    deps.docs.write(
      `${runDir}/output/${input.from}/${input.name}`,
      input.text ?? ""
    )
    outputs.push(`output/${input.from}/${input.name}`)
  }
  return { ok: true, outputs }
}
