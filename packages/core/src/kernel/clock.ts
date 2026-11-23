export interface Clock {
  /** Epoch milliseconds (DES-042: never Date.now() in core). */
  now(): number
}
