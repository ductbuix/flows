/** In-memory idempotency for mutating run controls (DES-011). */
export class IdempotencyStore {
  private readonly map = new Map<string, { status: number; body: unknown }>()

  get(requestId: string): { status: number; body: unknown } | undefined {
    return this.map.get(requestId)
  }

  set(requestId: string, status: number, body: unknown): void {
    this.map.set(requestId, { status, body })
  }
}
