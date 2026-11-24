import type { EffectResult } from "../runs/model.ts"
import { isAskPending, type StepEvent } from "./types.ts"

/** Fold StepEvents from one execute() into an EffectResult. */
export async function collectExecute(
  events: AsyncIterable<StepEvent>
): Promise<EffectResult> {
  const outputs: string[] = []
  let notice: { title: string; text: string } | undefined
  let branch: string | undefined
  let answer: Record<string, unknown> | undefined
  try {
    for await (const ev of events) {
      if (ev.kind === "output_written") outputs.push(ev.path)
      if (ev.kind === "notify") notice = { title: ev.title, text: ev.text }
      if (ev.kind === "waiting") {
        return { waiting: true, question: ev.question }
      }
      if (ev.kind === "failed") {
        return {
          ok: false,
          reason: ev.reason,
          ...(ev.message ? { message: ev.message } : {}),
        }
      }
      if (ev.kind === "done") {
        if (ev.outputs) outputs.push(...ev.outputs)
        branch = ev.branch
        answer = ev.answer
      }
    }
  } catch (e) {
    if (isAskPending(e)) return { waiting: true, question: e.question }
    throw e
  }
  return {
    ok: true,
    outputs: [...new Set(outputs)],
    ...(branch ? { branch } : {}),
    ...(answer ? { answer } : {}),
    ...(notice ? { notice } : {}),
  }
}
