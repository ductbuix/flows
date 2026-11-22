import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"
import { defineExecutor } from "./define.ts"
import { relOut } from "./step-paths.ts"

function listFiles(root: string, dir = root, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) listFiles(root, abs, out)
    else out.push(abs.slice(root.length + 1))
  }
  return out
}

/**
 * Folder target: copies each input's step files to the run `output/`.
 * Publish target: asks the tick to send the work copy (`nodes/publish.ts`).
 */
export const outputExecutor = defineExecutor({
  kind: "output",
  run(ctx) {
    if (ctx.node.kind === "output" && ctx.node.target === "publish") {
      if (!ctx.node.connection) throw new Error("publish needs a connection")
      return { publish: { connection: ctx.node.connection } }
    }
    mkdirSync(ctx.stepDir, { recursive: true })
    const outputs: string[] = []
    for (const input of ctx.inputs) {
      const dest = join(ctx.runRoot, "output", input.nodeId)
      rmSync(dest, { recursive: true, force: true })
      if (!existsSync(input.dir)) continue
      cpSync(input.dir, dest, { recursive: true })
      for (const rel of listFiles(dest)) {
        outputs.push(relOut("output", input.nodeId, ...rel.split("/")))
      }
    }
    return { outputs }
  },
})
