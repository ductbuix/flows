/** Lexicographic fractional ranks for docket card ordering (base 62). */

export const RANK_DIGITS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

const ZERO = RANK_DIGITS[0]!
const MID = RANK_DIGITS[Math.floor(RANK_DIGITS.length / 2)]!

function digitIndex(char: string): number {
  const i = RANK_DIGITS.indexOf(char)
  if (i < 0) {
    throw new Error(`invalid rank character: ${JSON.stringify(char)}`)
  }
  return i
}

function assertOrdered(a: string, b: string): void {
  if (a >= b) {
    throw new Error("rankBetween: lower bound must be less than upper bound")
  }
}

function rejectTrailingZero(key: string): void {
  if (key.slice(-1) === ZERO) {
    throw new Error("rank keys must not end with the smallest digit")
  }
}

function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) {
    throw new Error("rankBetween: internal bounds violation")
  }
  rejectTrailingZero(a)
  if (b !== null) {
    rejectTrailingZero(b)
  }

  if (b !== null) {
    let n = 0
    while ((a[n] ?? ZERO) === b[n]) {
      n++
    }
    if (n > 0) {
      return b.slice(0, n) + midpoint(a.slice(n), b.slice(n))
    }
  }

  const digitA = a.length > 0 ? digitIndex(a[0]!) : 0
  const digitB = b !== null ? digitIndex(b[0]!) : RANK_DIGITS.length

  if (digitB - digitA > 1) {
    const mid = Math.round(0.5 * (digitA + digitB))
    return RANK_DIGITS[mid]!
  }

  if (b !== null && b.length > 1) {
    return b.slice(0, 1)
  }

  return RANK_DIGITS[digitA]! + midpoint(a.slice(1), null)
}

/** Rank strictly between optional bounds; undefined means column start or end. */
export function rankBetween(a?: string, b?: string): string {
  if (a !== undefined && b !== undefined) {
    assertOrdered(a, b)
    return midpoint(a, b)
  }
  if (a === undefined && b === undefined) {
    return MID
  }
  if (a === undefined) {
    return midpoint("", b!)
  }
  return midpoint(a, null)
}
