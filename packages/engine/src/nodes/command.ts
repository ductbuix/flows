import { join } from "node:path"
import { defineExecutor } from "./define.ts"
import { readOptional, settleProcessOutput } from "./process.ts"

/** Command step: runs `run` in the workflow folder; stdout is the text. */
export const commandExecutor = defineExecutor({
  kind: "command",
  run(ctx) {
    const node = ctx.node
    if (node.kind !== "command") throw new Error("not a command node")
    return {
      launch: {
        agent: false,
        command: () => ({ shell: node.run, cwd: "workflow" }),
      },
    }
  },
  finish(ctx, attemptRoot) {
    return settleProcessOutput(
      ctx,
      attemptRoot,
      readOptional(join(attemptRoot, "stdout.log")) ?? ""
    )
  },
})
