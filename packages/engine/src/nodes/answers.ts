import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import {
  answerTypeHint,
  declaredAnswers,
  fillTemplate,
  templateProblems,
  type AnswerDecl,
  type AnswerParse,
  type NodeWorkflow,
  type TemplateText,
} from "@workspace/shared"
import { workflowDir } from "../paths.ts"
import type { ExecContext, ExecResult } from "./define.ts"

/** Where a failed answer is recorded, so the one fix attempt can read it. */
const ERROR_FILE = "answer-error.txt"

function read(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined
}

/** The declared answers of an Agent or LLM node, or none. */
export function nodeAnswers(ctx: ExecContext): readonly AnswerDecl[] {
  return declaredAnswers(ctx.node as { id: string; kind: string; answers?: AnswerDecl[] })
}

/** A frozen node file with `{{name}}` filled from the upstream answers. */
export function filledFile(ctx: ExecContext, name: string): string | undefined {
  const text = ctx.frozenFile(name)
  return text === undefined ? undefined : fillTemplate(text, ctx.answers)
}

export function attemptNumber(attemptRoot: string): number {
  return Number(/^attempt-(\d+)$/.exec(basename(attemptRoot))?.[1] ?? 1)
}

function previousAttempt(attemptRoot: string): string {
  return join(dirname(attemptRoot), `attempt-${attemptNumber(attemptRoot) - 1}`)
}

/** Why the previous attempt's answer was rejected; set only on the fix attempt. */
export function pendingAnswerFix(
  attemptRoot: string
): { error: string; previous: string } | undefined {
  const previous = previousAttempt(attemptRoot)
  const error = read(join(previous, ERROR_FILE))
  return error === undefined ? undefined : { error, previous }
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

/** What an LLM step is told about its reply. */
export function llmAnswerPrompt(decls: readonly AnswerDecl[]): string {
  return [
    "## Answer",
    "",
    "End your reply with one JSON object in a ```json block, with exactly these fields.",
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

/** The fix request for an LLM step: the rejected reply and the reason. */
export function llmFixPrompt(error: string, reply: string): string {
  return [
    "## Fix the answer",
    "",
    `Your previous reply was rejected: ${error.trim()}`,
    "",
    "Previous reply:",
    "",
    reply.trim(),
    "",
    "Reply again with the JSON object in a ```json block that matches the fields above.",
    "",
  ].join("\n")
}

/**
 * Settles the answer of a finished attempt (DES-032). A mismatch asks for
 * one fix attempt; a mismatch on that attempt fails with reason `answer`.
 */
export function settleAnswer(
  attemptRoot: string,
  decls: readonly AnswerDecl[],
  found: AnswerParse,
  base: ExecResult
): ExecResult {
  if (found.ok) {
    return { ...base, answer: found.value }
  }
  if (pendingAnswerFix(attemptRoot) !== undefined) {
    return { outputs: [], failed: "answer" }
  }
  writeFileSync(join(attemptRoot, ERROR_FILE), found.error)
  return { outputs: [], fix: true }
}

const FILL_FILES: Record<string, string[]> = {
  agent: ["prompt.md"],
  llm: ["prompt.md", "system.md"],
  judge: ["rule.md"],
  prompt: ["text.md"],
}

/** Every text of the graph that may use `{{name}}`. */
function templateTexts(home: string, graph: NodeWorkflow): TemplateText[] {
  const root = join(workflowDir(home, graph.id), "nodes")
  const out: TemplateText[] = []
  for (const n of graph.nodes) {
    if (n.kind === "approval") {
      out.push({ nodeId: n.id, label: "question", text: n.question })
    }
    for (const file of FILL_FILES[n.kind] ?? []) {
      const text = read(join(root, n.id, file))
      if (text !== undefined) out.push({ nodeId: n.id, label: file, text })
    }
  }
  return out
}

/** Fails a start when a template name is ambiguous (DES-032). */
export function assertNodeTemplatesValid(home: string, graph: NodeWorkflow): void {
  const problems = templateProblems(
    graph.nodes,
    graph.edges,
    templateTexts(home, graph)
  )
  const first = problems[0]
  if (first) {
    throw new Error(`node ${first.nodeId} ${first.label}: ${first.message}`)
  }
}
