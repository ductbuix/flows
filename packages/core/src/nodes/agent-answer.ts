import {
  answerTypeHint,
  declaredAnswers,
  parseAnswerText,
  type AnswerDecl,
  type AnswerParse,
} from "@workspace/contracts"

/** Where a failed answer is recorded for the one fix attempt. */
export const ANSWER_ERROR_FILE = "answer-error.txt"

type Docs = {
  read(path: string): { text: string } | null
  write(path: string, text: string): void
}

/** Declared answers on an agent/llm node, or none. */
export function nodeAnswerDecls(node: {
  id: string
  kind: string
  answers?: readonly AnswerDecl[]
}): readonly AnswerDecl[] {
  return declaredAnswers(node)
}

/** What an Agent is told about `out/answer.json`. */
export function agentAnswerPrompt(decls: readonly AnswerDecl[]): string {
  return [
    "## Answer",
    "",
    "When you finish, write `out/answer.json`: one JSON object with exactly these fields.",
    "",
    ...decls.map((d) => `- ${d.name}: ${answerTypeHint(d)}`),
    "",
  ].join("\n")
}

/** The fix request for an Agent: keep the work, rewrite only the answer. */
export function agentFixPrompt(error: string): string {
  return [
    "## Fix the answer",
    "",
    `Your \`out/answer.json\` was rejected: ${error.trim()}`,
    "Your earlier files are kept in out/. Do not redo the work; write a corrected `out/answer.json`.",
    "",
  ].join("\n")
}

export type SettleAnswerResult =
  | { ok: true; answer: Record<string, unknown> }
  | { ok: false; fix: true; error: string }
  | { ok: false; reason: "answer" }

/**
 * Settle a finished attempt's answer (DES-032). A mismatch asks for one
 * fix attempt; a mismatch on that attempt fails with reason `answer`.
 */
export function settleAnswer(
  docs: Docs,
  stepDir: string,
  decls: readonly AnswerDecl[],
  found: AnswerParse
): SettleAnswerResult {
  if (found.ok) return { ok: true, answer: found.value }
  const errorPath = `${stepDir}/${ANSWER_ERROR_FILE}`
  if (docs.read(errorPath)) {
    return { ok: false, reason: "answer" }
  }
  docs.write(errorPath, found.error)
  return { ok: false, fix: true, error: found.error }
}

/** Read and parse `out/answer.json` under the step folder. */
export function readStepAnswer(
  docs: Docs,
  stepDir: string,
  decls: readonly AnswerDecl[]
): AnswerParse {
  const raw = docs.read(`${stepDir}/out/answer.json`)?.text ?? ""
  return parseAnswerText(decls, raw)
}
