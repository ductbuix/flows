import { createServer } from "node:net"

/** Ports per attempt block (DES-026 / BL-056). */
export const DEFAULT_PORT_COUNT = 10

/** First candidate base; stays above common app and e2e ports. */
export const PORT_RANGE_START = 22_000

const PORT_RANGE_END = 49_000

export type PortBlock = {
  base: number
  count: number
}

type Held = PortBlock & { key: string }

/**
 * Process-wide port blocks for live attempts. A block is free when no
 * live attempt holds it and a bind check on 127.0.0.1 succeeds.
 */
export class PortLeaseManager {
  private readonly byKey = new Map<string, Held>()
  private readonly byBase = new Map<number, Held>()
  /** Serialize leases so parallel launches do not pick the same base. */
  private chain: Promise<void> = Promise.resolve()

  /** Lease a free block; throws when the range is exhausted. */
  lease(key: string, count: number = DEFAULT_PORT_COUNT): Promise<PortBlock> {
    const run = this.chain.then(() => this.leaseUnlocked(key, count))
    this.chain = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private async leaseUnlocked(key: string, count: number): Promise<PortBlock> {
    const existing = this.byKey.get(key)
    if (existing) return { base: existing.base, count: existing.count }

    for (
      let base = PORT_RANGE_START;
      base + count - 1 <= PORT_RANGE_END;
      base += count
    ) {
      if (this.byBase.has(base)) continue
      if (!(await canBindBase(base))) continue
      const held: Held = { key, base, count }
      this.byKey.set(key, held)
      this.byBase.set(base, held)
      return { base, count }
    }
    throw new Error("no free port block")
  }

  /**
   * Re-claim a recorded block after resume (no bind check). No-op when
   * another key already holds the base.
   */
  rehold(key: string, block: PortBlock): void {
    const existing = this.byKey.get(key)
    if (existing) return
    const taken = this.byBase.get(block.base)
    if (taken && taken.key !== key) return
    const held: Held = { key, base: block.base, count: block.count }
    this.byKey.set(key, held)
    this.byBase.set(block.base, held)
  }

  /** Release by attempt key; idempotent. */
  release(key: string): void {
    const held = this.byKey.get(key)
    if (!held) return
    this.byKey.delete(key)
    this.byBase.delete(held.base)
  }

  /** Test helper: drop every lease. */
  reset(): void {
    this.byKey.clear()
    this.byBase.clear()
  }

  /** Test helper: bases currently held. */
  heldBases(): number[] {
    return [...this.byBase.keys()].sort((a, b) => a - b)
  }
}

export const portLeases = new PortLeaseManager()

export function portLeaseKey(
  runId: string,
  taskId: string,
  attempt: number
): string {
  return `${runId}:${taskId}:${attempt}`
}

function canBindBase(base: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.unref()
    server.once("error", () => resolve(false))
    server.listen(base, "127.0.0.1", () => {
      server.close((err) => resolve(!err))
    })
  })
}
