import type { Ids } from "../kernel/ids.ts"

export function createFakeIds(): FakeIds {
  return new FakeIds()
}

export class FakeIds implements Ids {
  private next = 0

  id(prefix: string): string {
    const n = this.next++
    return `${prefix}_${n}`
  }

  reset(): void {
    this.next = 0
  }
}
