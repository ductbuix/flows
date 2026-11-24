/** Per-connection client metadata passed into FCP method handlers. */
export type ClientInfo = {
  readonly name: string
  readonly version: string
}

/** Request-scoped context for a bound FCP peer (DES-040). */
export type ClientContext = {
  readonly signal: AbortSignal
  readonly clientInfo?: ClientInfo
}
