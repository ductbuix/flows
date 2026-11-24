import type { Clock } from "../kernel/clock.ts"

export function createFakeClock(startMs = 0): FakeClock {
  return new FakeClock(startMs)
}

export class FakeClock implements Clock {
  private ms: number

  constructor(startMs = 0) {
    this.ms = startMs
  }

  now(): number {
    return this.ms
  }

  set(ms: number): void {
    this.ms = ms
  }

  advance(byMs: number): void {
    this.ms += byMs
  }
}
