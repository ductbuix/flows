import type { EngineEvent } from "@workspace/contracts"
import type { EventStore } from "../ports/event-store.ts"
import { decide } from "./decide.ts"
import { fold } from "./fold.ts"
import { effectAttemptKey, pendingEffects } from "./pending-effects.ts"
import type { DecideInput, EffectResult, RunEffect, RunState } from "./model.ts"

export type RunActorDeps = {
  events: EventStore
  /** Execute a side effect; results return as `effect_result` inputs. */
  runEffect: (effect: RunEffect, state: RunState) => Promise<EffectResult>
}

type MailboxEntry = {
  input: DecideInput
  resolve: () => void
  reject: (err: unknown) => void
}

/**
 * One mailbox per live run: decide, append, then run effects (DES-041).
 * No two writers of one run.
 */
export class RunActor {
  private state: RunState | null = null
  private readonly mailbox: MailboxEntry[] = []
  private draining = false
  private readonly issued = new Set<string>()
  /**
   * Last EventStore seq for this run (global high-water of our events).
   * Fold's `state.seq` is a local 1..n counter and must not be used as
   * expectSeq once other runs have advanced the store (BL-195 e2e).
   */
  private storeSeq = 0

  constructor(
    readonly runId: string,
    private readonly deps: RunActorDeps
  ) {}

  getState(): RunState | null {
    return this.state
  }

  /** Queue an input; resolves when that input has been handled. */
  push(input: DecideInput): Promise<void> {
    return new Promise((resolve, reject) => {
      this.mailbox.push({ input, resolve, reject })
      void this.drain()
    })
  }

  /**
   * Decide + append only (no effects). Simulates a crash between append
   * and effect for recovery tests.
   */
  decideAndAppend(input: DecideInput): RunEffect[] {
    const out = decide(this.state, input)
    if (out.events.length > 0) this.append(out.events)
    return out.effects
  }

  /**
   * Replay the event log and re-issue effects whose result is missing.
   * Idempotent by step attempt id.
   */
  async recover(): Promise<void> {
    const stored = this.deps.events.read(this.runId)
    this.state = null
    this.storeSeq = 0
    this.issued.clear()
    for (const s of stored) {
      this.state = fold(this.state, s.event)
      this.storeSeq = s.seq
      if (s.event.type === "attempt_started" && s.event.nodeId) {
        this.issued.add(
          `${s.event.nodeId}:${s.event.pass ?? 1}:${s.event.attempt}`
        )
      }
    }
    if (!this.state) return
    for (const fx of pendingEffects(this.state)) {
      await this.runOneEffect(fx)
    }
  }

  private async drain(): Promise<void> {
    if (this.draining) return
    this.draining = true
    try {
      while (this.mailbox.length > 0) {
        const entry = this.mailbox.shift()!
        try {
          await this.handle(entry.input)
          entry.resolve()
        } catch (err) {
          entry.reject(err)
        }
      }
    } finally {
      this.draining = false
      if (this.mailbox.length > 0) void this.drain()
    }
  }

  private async handle(input: DecideInput): Promise<void> {
    const out = decide(this.state, input)
    if (out.events.length > 0) this.append(out.events)
    for (const fx of out.effects) {
      await this.runOneEffect(fx)
    }
    if (input.kind === "start" && this.state?.status === "running") {
      await this.drainSchedule(input.at)
    }
  }

  /**
   * Keep waking while decide only emits schedule events (skips / run
   * end) with no effects. One skip per wake used to leave the run
   * parked after a failed upstream (BL-196 / BL-209).
   */
  private async drainSchedule(at: string): Promise<void> {
    for (let i = 0; i < 1000; i++) {
      if (!this.state || this.state.status !== "running") return
      const out = decide(this.state, { kind: "wake", at })
      if (out.events.length === 0 && out.effects.length === 0) return
      if (out.events.length > 0) this.append(out.events)
      if (out.effects.length > 0) {
        for (const fx of out.effects) {
          await this.runOneEffect(fx)
        }
        return
      }
    }
  }

  /**
   * Fold events appended outside the actor (ACP permission/question/
   * plan_review). `RunState.seq` is an event count; store `seq` is the
   * global row id — never compare them (BL-195).
   */
  private catchUp(): void {
    const stored = this.deps.events.read(this.runId)
    const have = this.state?.seq ?? 0
    for (let i = have; i < stored.length; i++) {
      const row = stored[i]!
      this.state = fold(this.state, row.event)
      this.storeSeq = row.seq
    }
  }

  private append(events: readonly EngineEvent[]): void {
    this.catchUp()
    const expectSeq = this.storeSeq
    const result = this.deps.events.append(this.runId, events, { expectSeq })
    if (!result.ok) {
      throw new Error(
        `event append conflict: expected ${expectSeq}, got ${result.lastSeq}`
      )
    }
    for (const s of result.appended) {
      this.state = fold(this.state, s.event)
    }
    if (result.appended.length > 0) this.storeSeq = result.lastSeq
  }

  private async runOneEffect(fx: RunEffect): Promise<void> {
    if (!this.state) return
    const key = effectAttemptKey(fx)
    const at = new Date().toISOString()

    if (fx.kind === "launch_step" && !this.issued.has(key)) {
      this.append([
        {
          type: "attempt_started",
          runId: this.runId,
          at,
          taskId: fx.nodeId,
          nodeId: fx.nodeId,
          pass: fx.pass,
          attempt: fx.attempt,
        },
      ])
    }
    this.issued.add(key)

    // post_inbox parks until an `answer` input; do not feed effect_result.
    if (fx.kind === "post_inbox") {
      await this.deps.runEffect(fx, this.state!)
      return
    }

    try {
      const result = await this.deps.runEffect(fx, this.state!)
      await this.handle({
        kind: "effect_result",
        at,
        nodeId: fx.nodeId,
        pass: fx.pass,
        result,
      })
      if (this.state?.status === "running") {
        await this.drainSchedule(at)
      }
    } catch (err) {
      // Host abort (cancel): leave the step open; a queued cancel input settles.
      if (err instanceof DOMException && err.name === "AbortError") return
      // A thrown node error must settle the step, not leave it running.
      await this.handle({
        kind: "effect_result",
        at,
        nodeId: fx.nodeId,
        pass: fx.pass,
        result: {
          ok: false,
          reason: "exit",
          message: err instanceof Error ? err.message : String(err),
        },
      })
      if (this.state?.status === "running") {
        await this.drainSchedule(at)
      }
    }
  }
}
