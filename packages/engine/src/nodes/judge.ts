import { createHash } from "node:crypto"
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { evaluateCheck, type AgentJudge } from "@workspace/shared"
import { judgeAnswerPrompt } from "../agent-prompt.ts"
import { resolveAttemptModelFields } from "../attempt-model.ts"
import { writeCursorTrustMarker } from "../cursor-trust.ts"
import {
  buildJudgeShellCommand,
  judgeNodeKey,
  judgeVerdict,
  resolveJudgeModelEffort,
} from "../judge.ts"
import { filledFile } from "./answers.ts"
import { forwardInputs, joinedInputText } from "./forward.ts"
import { defineExecutor, type ExecContext, type ExecResult } from "./define.ts"
import { readOptional } from "./process.ts"

type Recorded = { key: string; verdict: "yes" | "no"; answer: string }

function listFiles(dir: string, base = ""): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const rel = base ? `${base}/${name}` : name
      const abs = join(dir, name)
      return statSync(abs).isDirectory()
        ? listFiles(abs, rel)
        : [`${rel}:${statSync(abs).size}`]
    })
}

/** Hash of what the Judge receives: each input's text and file list. */
function inputHash(ctx: ExecContext): string {
  const h = createHash("sha256")
  for (const input of ctx.inputs) {
    h.update(input.nodeId)
    h.update("\0")
    h.update(readOptional(join(input.dir, "text.md")) ?? "")
    h.update("\0")
    h.update(listFiles(join(input.dir, "files")).join("\n"))
    h.update("\0")
  }
  return h.digest("hex")
}

function judgeOf(ctx: ExecContext): {
  node: Extract<ExecContext["node"], { kind: "judge" }> & {
    cli: "claude" | "cursor"
  }
  judge: AgentJudge
} {
  const node = ctx.node
  if (node.kind !== "judge") throw new Error("not a judge node")
  if (node.cli === undefined) throw new Error("missing_cli")
  const withCli = { ...node, cli: node.cli }
  return {
    node: withCli,
    judge: {
      cli: node.cli,
      ...(node.model !== undefined ? { model: node.model } : {}),
      ...(node.effort !== undefined ? { effort: node.effort } : {}),
    },
  }
}

function keyOf(ctx: ExecContext): string {
  const { judge } = judgeOf(ctx)
  return judgeNodeKey({
    judge,
    resolved: resolveJudgeModelEffort(judge, {
      workflowAgent: ctx.graph.agent,
    }),
    nodeId: ctx.node.id,
    pass: ctx.pass,
    rule: filledFile(ctx, "rule.md") ?? "",
    inputHash: inputHash(ctx),
  })
}

function readRecorded(ctx: ExecContext): Recorded | undefined {
  const raw = readOptional(join(ctx.stepDir, "judge.json"))
  if (raw === undefined) return undefined
  try {
    const v = JSON.parse(raw) as Recorded
    return v.verdict === "yes" || v.verdict === "no" ? v : undefined
  } catch {
    return undefined
  }
}

/**
 * Check mode (DES-032): tests a named answer from upstream with the
 * operator. No process, no slot: the step settles in the tick.
 */
function runCheck(ctx: ExecContext): ExecResult {
  const node = ctx.node
  if (node.kind !== "judge" || node.check === undefined) {
    throw new Error("missing_check")
  }
  const passed = evaluateCheck(node.check, ctx.answers[node.check.field])
  const text = joinedInputText(ctx)
  return { outputs: forwardInputs(ctx, text), branch: passed ? "yes" : "no" }
}

/**
 * Judge (DES-032). Rule mode: the CLI reads `rule.md`, answers yes or
 * no for the input, and the first word picks the branch. Anything else
 * fails the step with reason `unclear`. Check mode tests a named answer.
 */
export const judgeExecutor = defineExecutor({
  kind: "judge",
  run(ctx) {
    if (ctx.node.kind === "judge" && ctx.node.mode === "check")
      return runCheck(ctx)
    const { node, judge } = judgeOf(ctx)
    const frozen = ctx.frozenPath("rule.md")
    if (!existsSync(frozen)) throw new Error("missing_rule")
    const key = keyOf(ctx)
    const recorded = readRecorded(ctx)
    if (recorded?.key === key) {
      const text = readOptional(join(ctx.stepDir, "text.md")) ?? ""
      return { outputs: forwardInputs(ctx, text), branch: recorded.verdict }
    }
    return {
      launch: {
        agent: true,
        cli: node.cli,
        instructions: frozen,
        modelFields: resolveAttemptModelFields(judge, ctx.graph),
        prepare({ attemptRoot, inputDir }) {
          // The CLI runs in the attempt folder: keep the rule inside it.
          writeFileSync(
            join(inputDir, "rule.md"),
            filledFile(ctx, "rule.md") ?? ""
          )
          if (node.cli === "cursor") {
            writeCursorTrustMarker(ctx.workflowRoot)
            writeCursorTrustMarker(attemptRoot)
          }
        },
        command({ attemptRoot }) {
          return {
            shell: buildJudgeShellCommand(
              judge,
              join(attemptRoot, "input", "rule.md"),
              {
                workflowAgent: ctx.graph.agent,
                prompt: judgeAnswerPrompt("input/rule.md"),
              }
            ),
            cwd: "attempt",
            allowCursorHome: node.cli === "cursor",
          }
        },
      },
    }
  },
  finish(ctx, attemptRoot): ExecResult {
    const answer = readOptional(join(attemptRoot, "stdout.log")) ?? ""
    const verdict = judgeVerdict(answer)
    if (!verdict) return { outputs: [], failed: "unclear" }
    const text = readOptional(join(attemptRoot, "input", "text.md")) ?? ""
    const outputs = forwardInputs(ctx, text)
    const recorded: Recorded = {
      key: keyOf(ctx),
      verdict,
      answer: answer.trim(),
    }
    writeFileSync(join(ctx.stepDir, "judge.json"), JSON.stringify(recorded))
    return { outputs, branch: verdict }
  },
})
