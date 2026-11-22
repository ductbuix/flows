import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { defineExecutor } from "./define.ts"
import { relOut } from "./step-paths.ts"

/** Writes the frozen `text.md` as the step output (DES-034). */
export const promptExecutor = defineExecutor({
  kind: "prompt",
  run(ctx) {
    rmSync(ctx.stepDir, { recursive: true, force: true })
    mkdirSync(ctx.stepDir, { recursive: true })
    writeFileSync(join(ctx.stepDir, "text.md"), ctx.frozenFile("text.md") ?? "")
    return {
      outputs: [relOut("nodes", ctx.node.id, `pass-${ctx.pass}`, "text.md")],
    }
  },
})
