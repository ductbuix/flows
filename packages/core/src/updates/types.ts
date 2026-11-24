/** Buffered engine update before fan-out (DES-040 `namespace/update`). */
export type BufferedUpdate = {
  readonly seq: number
  readonly notification: string
  readonly params: Record<string, unknown> & { kind: string }
}

export type UpdateNotifyPeer = {
  notify(method: string, params: unknown): void
}
