export type CliCommand =
  | { name: "engine"; stdio: true }
  | { name: "inbox" }
  | { name: "run"; workflowId: string; cardId?: string }
  | { name: "help" }

/** Minimal argv parser for `flows` (no flag library). */
export function parseArgs(argv: string[]): CliCommand {
  const [cmd, ...rest] = argv
  if (cmd === undefined || cmd === "help" || cmd === "--help" || cmd === "-h") {
    return { name: "help" }
  }
  if (cmd === "engine") {
    if (rest.includes("--stdio")) return { name: "engine", stdio: true }
    throw new Error("usage: flows engine --stdio")
  }
  if (cmd === "inbox") {
    if (rest.length > 0) throw new Error("usage: flows inbox")
    return { name: "inbox" }
  }
  if (cmd === "run") {
    return parseRun(rest)
  }
  throw new Error(`unknown command: ${cmd}`)
}

function parseRun(rest: string[]): CliCommand {
  let workflowId: string | undefined
  let cardId: string | undefined
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!
    if (arg === "--card") {
      const value = rest[++i]
      if (!value) throw new Error("usage: flows run <workflow> --card <id>")
      cardId = value
      continue
    }
    if (arg.startsWith("-")) {
      throw new Error(`unknown flag: ${arg}`)
    }
    if (workflowId !== undefined) {
      throw new Error("usage: flows run <workflow> [--card <id>]")
    }
    workflowId = arg
  }
  if (!workflowId) {
    throw new Error("usage: flows run <workflow> [--card <id>]")
  }
  return { name: "run", workflowId, cardId }
}

export const HELP = `flows — Flows client (FCP)

Usage:
  flows engine --stdio          Serve FCP on stdin/stdout
  flows inbox                   List open inbox items
  flows run <workflow> [--card <id>]
                                Start a run and stream until finished
`
