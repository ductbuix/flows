#!/usr/bin/env npx tsx
import { HELP, parseArgs } from "./args.ts"
import { runInbox } from "./commands/inbox.ts"
import { runWorkflow } from "./commands/run.ts"
import { serveEngineStdio } from "./engine-stdio.ts"
import { resolveHome } from "./home.ts"

export async function main(argv: string[]): Promise<number> {
  let command
  try {
    command = parseArgs(argv)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${message}\n`)
    return 2
  }

  const home = resolveHome()
  switch (command.name) {
    case "help":
      process.stdout.write(HELP)
      return 0
    case "engine":
      serveEngineStdio(home)
      return await waitForever()
    case "inbox":
      return await runInbox(home)
    case "run":
      return await runWorkflow({
        home,
        workflowId: command.workflowId,
        cardId: command.cardId,
      })
  }
}

function waitForever(): Promise<number> {
  return new Promise(() => {
    /* stdio host stays up until stdin closes / signal */
  })
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith("/main.ts") ||
    process.argv[1].endsWith("/main.js") ||
    process.argv[1].includes("/cli/"))

if (isDirect) {
  main(process.argv.slice(2))
    .then((code) => {
      if (code !== 0) process.exitCode = code
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`${message}\n`)
      process.exitCode = 1
    })
}
