import { describe, expect, it } from "vitest"
import { createFakeEventStore } from "../testing/fake-event-store.ts"
import { RunActor } from "./actor.ts"
import { at, parse } from "./decide-harness.ts"
import { latestStep, type EffectResult, type RunEffect } from "./model.ts"
import { pendingEffects } from "./pending-effects.ts"

const graph = parse(
  [{ id: "work", kind: "command", run: "true" }],
  [{ from: "t", to: "work" }]
)

function ok(nodeId = "work"): EffectResult {
  return { ok: true, outputs: [`out/${nodeId}`] }
}

/** Append attempt + settle a launch_step without going through runOneEffect. */
function settleLaunch(actor: RunActor, fx: RunEffect, atIso: string): void {
  if (fx.kind !== "launch_step") throw new Error("expected launch_step")
  actor.decideAndAppend({
    kind: "effect_result",
    at: atIso,
    nodeId: fx.nodeId,
    pass: fx.pass,
    result: ok(fx.nodeId),
  })
  // Mark attempt in the log the way the shell would, via fold path used by tests:
  // effect_result alone is enough for decide (harness adds attempt events separately).
}

describe("RunActor mailbox", () => {
  it("handles start, effect_result, answer, cancel, agent_event in order", async () => {
    const order: string[] = []
    const g = parse(
      [{ id: "ask", kind: "approval", question: "Go?" }],
      [{ from: "t", to: "ask" }]
    )
    const events = createFakeEventStore()
    const actor = new RunActor("r1", {
      events,
      runEffect: async (fx) => {
        order.push(`effect:${fx.kind}:${fx.nodeId}`)
        if (fx.kind === "post_inbox") {
          return { waiting: true, question: fx.question }
        }
        return ok(fx.nodeId)
      },
    })

    await actor.push({ kind: "start", at, runId: "r1", graph: g })
    order.push("after-start")
    expect(latestStep(actor.getState()!.steps, "ask")?.status).toBe("waiting")

    await actor.push({
      kind: "answer",
      at,
      nodeId: "ask",
      pass: 1,
      decision: "approved",
    })
    order.push("after-answer")

    await actor.push({
      kind: "agent_event",
      at,
      nodeId: "ask",
      pass: 1,
      event: { type: "noop" },
    })
    order.push("after-agent")

    await actor.push({ kind: "cancel", at })
    order.push("after-cancel")

    expect(order).toEqual([
      "effect:launch_step:t",
      "effect:post_inbox:ask",
      "after-start",
      "after-answer",
      "after-agent",
      "after-cancel",
    ])
    expect(actor.getState()?.status).toBe("cancelled")
  })

  it("queues inputs and processes them one at a time", async () => {
    const seen: string[] = []
    let release!: () => void
    const hold = new Promise<void>((r) => {
      release = r
    })
    const events = createFakeEventStore()
    const actor = new RunActor("r1", {
      events,
      runEffect: async () => {
        seen.push("effect-start")
        await hold
        seen.push("effect-end")
        return ok()
      },
    })

    const started = actor.push({ kind: "start", at, runId: "r1", graph })
    await Promise.resolve()
    await Promise.resolve()
    expect(seen).toContain("effect-start")

    const cancelled = actor.push({ kind: "cancel", at })
    seen.push("cancel-queued")
    release()
    await Promise.all([started, cancelled])
    expect(seen.indexOf("cancel-queued")).toBeLessThan(
      seen.indexOf("effect-end")
    )
  })
})

describe("RunActor recovery", () => {
  it("crash between append and effect does not duplicate a step", async () => {
    const launches: string[] = []
    const events = createFakeEventStore()
    const actor = new RunActor("r1", {
      events,
      runEffect: async (fx: RunEffect) => {
        if (fx.kind === "launch_step") {
          launches.push(`${fx.nodeId}:${fx.attempt}`)
        }
        return ok(fx.nodeId)
      },
    })

    actor.decideAndAppend({ kind: "start", at, runId: "r1", graph })
    // First wake: trigger. Settle it so the next wake targets work.
    const triggerFx = actor.decideAndAppend({ kind: "wake", at })
    expect(triggerFx[0]).toMatchObject({
      kind: "launch_step",
      nodeId: "t",
    })
    settleLaunch(actor, triggerFx[0]!, at)
    // Trigger step_done leaves step running until wake schedules next —
    // feed a wake that only schedules work, then crash before the effect.
    const workFx = actor.decideAndAppend({ kind: "wake", at })
    expect(workFx).toEqual([
      { kind: "launch_step", nodeId: "work", pass: 1, attempt: 1 },
    ])
    expect(latestStep(actor.getState()!.steps, "work")).toMatchObject({
      status: "running",
      attempts: 0,
    })
    expect(
      events.read("r1").filter((e) => e.event.type === "attempt_started")
    ).toHaveLength(0)

    await actor.recover()
    expect(launches).toEqual(["work:1"])
    expect(latestStep(actor.getState()!.steps, "work")?.status).toBe("done")
    expect(actor.getState()?.steps.steps.work).toHaveLength(1)
    expect(actor.getState()?.status).toBe("succeeded")

    launches.length = 0
    await actor.recover()
    expect(launches).toEqual([])
    expect(actor.getState()?.steps.steps.work).toHaveLength(1)
  })

  it("pendingEffects is idempotent by step attempt id", () => {
    const events = createFakeEventStore()
    const actor = new RunActor("r1", {
      events,
      runEffect: async () => ok(),
    })
    actor.decideAndAppend({ kind: "start", at, runId: "r1", graph })
    const triggerFx = actor.decideAndAppend({ kind: "wake", at })
    settleLaunch(actor, triggerFx[0]!, at)
    actor.decideAndAppend({ kind: "wake", at })
    const state = actor.getState()!
    expect(pendingEffects(state)).toEqual(pendingEffects(state))
    expect(pendingEffects(state)[0]).toMatchObject({
      kind: "launch_step",
      nodeId: "work",
      attempt: 1,
    })
  })
})
