import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Condition } from "@workspace/shared"

export type ConditionContext = {
  /** Latest exit code of the subject attempt/task, if any. */
  exitCode?: number
  /** Attempt root (contains `out/`). Required for expr. */
  attemptRoot?: string
  /** For task-level `when` with exit: latest exit per need task id. */
  needExitCodes?: Record<string, number | undefined>
}

/** Evaluate exit / expr / all / any (DES-004). Agent is BL-011. */
export function evaluateCondition(
  condition: Condition,
  ctx: ConditionContext
): boolean {
  if ("exit" in condition) {
    return matchExit(condition.exit, ctx)
  }
  if ("expr" in condition) {
    return evaluateExpr(condition.expr, ctx.attemptRoot)
  }
  if ("all" in condition) {
    return condition.all.every((c) => evaluateCondition(c, ctx))
  }
  return condition.any.some((c) => evaluateCondition(c, ctx))
}

function matchExit(
  expected: number | number[],
  ctx: ConditionContext
): boolean {
  const set = new Set(Array.isArray(expected) ? expected : [expected])
  if (ctx.needExitCodes) {
    const codes = Object.values(ctx.needExitCodes)
    if (codes.length === 0) return false
    return codes.every((code) => code !== undefined && set.has(code))
  }
  return ctx.exitCode !== undefined && set.has(ctx.exitCode)
}

/**
 * Safe subset: json/text loads, property access, literals, comparisons,
 * && || ! and parentheses. No other calls or assignments.
 */
export function evaluateExpr(
  source: string,
  attemptRoot: string | undefined
): boolean {
  if (!attemptRoot) return false
  const value = evalExpr(source.trim(), attemptRoot)
  return Boolean(value)
}

function evalExpr(source: string, attemptRoot: string): unknown {
  let i = 0

  function peek(): string {
    return source[i] ?? ""
  }
  function next(): string {
    return source[i++] ?? ""
  }
  function skipWs(): void {
    while (/\s/.test(peek())) next()
  }
  function match(lit: string): boolean {
    skipWs()
    if (source.slice(i, i + lit.length) === lit) {
      i += lit.length
      return true
    }
    return false
  }

  function parsePrimary(): unknown {
    skipWs()
    if (match("(")) {
      const v = parseOr()
      if (!match(")")) throw new Error("expected )")
      return v
    }
    if (
      source.slice(i, i + 5) === "json(" ||
      source.slice(i, i + 5) === "text("
    ) {
      const kind = source.slice(i, i + 4) as "json" | "text"
      i += 5
      skipWs()
      if (next() !== "'") throw new Error("expected string path")
      let path = ""
      while (peek() && peek() !== "'") path += next()
      if (next() !== "'") throw new Error("unterminated path")
      skipWs()
      if (next() !== ")") throw new Error("expected )")
      const raw = readFileSync(join(attemptRoot, path), "utf8")
      const loaded: unknown = kind === "json" ? JSON.parse(raw) : raw
      return parseAccess(loaded)
    }
    if (match("true")) return true
    if (match("false")) return false
    if (peek() === "'") {
      next()
      let s = ""
      while (peek() && peek() !== "'") s += next()
      if (next() !== "'") throw new Error("unterminated string")
      return s
    }
    if (
      /[0-9.]/.test(peek()) ||
      (peek() === "-" && /[0-9]/.test(source[i + 1] ?? ""))
    ) {
      let num = ""
      if (peek() === "-") num += next()
      while (/[0-9.]/.test(peek())) num += next()
      return Number(num)
    }
    throw new Error(`unexpected at ${i}: ${source.slice(i)}`)
  }

  function parseAccess(base: unknown): unknown {
    let value = base
    for (;;) {
      skipWs()
      if (match(".")) {
        skipWs()
        let name = ""
        if (!/[A-Za-z_]/.test(peek())) throw new Error("expected property")
        while (/[A-Za-z0-9_]/.test(peek())) name += next()
        value = (value as Record<string, unknown>)[name]
        continue
      }
      if (match("[")) {
        const key = parsePrimary()
        if (!match("]")) throw new Error("expected ]")
        value = (value as Record<string, unknown>)[String(key)]
        continue
      }
      break
    }
    return value
  }

  function parseUnary(): unknown {
    skipWs()
    if (match("!")) return !parseUnary()
    return parsePrimary()
  }

  function parseCmp(): unknown {
    const left = parseUnary()
    skipWs()
    const ops = ["==", "!=", "<=", ">=", "<", ">"] as const
    for (const op of ops) {
      if (match(op)) {
        const right = parseUnary()
        switch (op) {
          case "==":
            return left === right
          case "!=":
            return left !== right
          case "<":
            return (left as number) < (right as number)
          case ">":
            return (left as number) > (right as number)
          case "<=":
            return (left as number) <= (right as number)
          case ">=":
            return (left as number) >= (right as number)
        }
      }
    }
    return left
  }

  function parseAnd(): unknown {
    let left = parseCmp()
    while (match("&&")) left = Boolean(left) && Boolean(parseCmp())
    return left
  }

  function parseOr(): unknown {
    let left = parseAnd()
    while (match("||")) left = Boolean(left) || Boolean(parseAnd())
    return left
  }

  const result = parseOr()
  skipWs()
  if (i < source.length) throw new Error(`trailing input: ${source.slice(i)}`)
  return result
}
