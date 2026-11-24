import type { ChangeSet } from "@workspace/contracts"
import { z } from "zod"
import { defineNodeKind } from "../define.ts"
import { needsPersonGate } from "../publish-gate.ts"
import type { PublishPort } from "../../ports/publish.ts"
import type { StepContext, StepEvent } from "../types.ts"

const settings = z.object({
  target: z.literal("publish"),
  connection: z.string().min(1),
})

type Settings = z.infer<typeof settings>

const CHANGESET_FILE = "changeset.json"

/**
 * Output publish: diff work copy, optional approval, connector apply (BL-195).
 * Registered as kind `publish`; YAML remains `output` + `target: publish`.
 */
export const publishKind = defineNodeKind({
  kind: "publish",
  settings,
  ports: { in: ["text", "file"], out: ["file"] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    const port = ctx.publish
    if (!port) {
      yield { kind: "failed", reason: "exit", message: "publish_port_missing" }
      return
    }
    const connection = ctx.settings.connection
    const policy = port.policy(connection)
    if (!policy || policy === "read-only") {
      yield { kind: "failed", reason: "exit", message: "publish_read_only" }
      return
    }

    if (ctx.decision === "approved") {
      yield* applyStored(ctx, port, connection)
      return
    }

    const changeSet = await port.diff({
      connectionId: connection,
      runDir: ctx.runDir,
      nodeId: ctx.node.id,
      runId: ctx.runId ?? "run",
    })
    if (changeSet.ops.length === 0) {
      yield { kind: "done", outputs: [] }
      return
    }

    await ctx.outputs.write(CHANGESET_FILE, JSON.stringify(changeSet, null, 2))

    if (needsPersonGate(policy, changeSet)) {
      const n = changeSet.ops.length
      const question = `Publish ${n} change${n === 1 ? "" : "s"} to ${connection}?`
      const decision = await ctx.inbox.ask(question)
      if (decision !== "approved") {
        yield { kind: "waiting", question }
        return
      }
    }

    yield* applyChangeSet(ctx, port, connection, changeSet)
  },
})

async function* applyStored(
  ctx: StepContext<Settings>,
  port: PublishPort,
  connection: string
): AsyncIterable<StepEvent> {
  const raw = ctx.docs.read(`${ctx.stepDir}/${CHANGESET_FILE}`)?.text
  if (!raw) {
    yield { kind: "failed", reason: "exit", message: "missing_changeset" }
    return
  }
  let changeSet: ChangeSet
  try {
    changeSet = JSON.parse(raw) as ChangeSet
  } catch {
    yield { kind: "failed", reason: "exit", message: "bad_changeset" }
    return
  }
  yield* applyChangeSet(ctx, port, connection, changeSet)
}

async function* applyChangeSet(
  ctx: StepContext<Settings>,
  port: PublishPort,
  connection: string,
  changeSet: ChangeSet
): AsyncIterable<StepEvent> {
  const outcome = await port.apply({
    connectionId: connection,
    changeSet,
    runDir: ctx.runDir,
  })
  if (outcome.status !== "applied") {
    yield {
      kind: "failed",
      reason: "exit",
      message: outcome.message,
    }
    return
  }
  port.advanceBase?.(connection, ctx.runDir)
  const path = await ctx.outputs.write(
    "result.json",
    JSON.stringify(outcome.result, null, 2)
  )
  yield { kind: "output_written", path }
  yield { kind: "done", outputs: [path] }
}
