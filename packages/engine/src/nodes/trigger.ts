import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { defineExecutor } from "./define.ts"
import { relOut } from "./step-paths.ts"

/** Run input text and files become the step output (DES-034). */
export const triggerExecutor = defineExecutor({
  kind: "trigger",
  run(ctx) {
    rmSync(ctx.stepDir, { recursive: true, force: true })
    mkdirSync(ctx.stepDir, { recursive: true })
    const input = join(ctx.runRoot, "input")
    const textPath = join(input, "text.md")
    const text = existsSync(textPath) ? readFileSync(textPath, "utf8") : ""
    writeFileSync(join(ctx.stepDir, "text.md"), text)
    const base = relOut("nodes", ctx.node.id, `pass-${ctx.pass}`)
    const outputs = [relOut(base, "text.md")]
    if (existsSync(input)) {
      for (const name of readdirSync(input).sort()) {
        if (name === "text.md") continue
        cpSync(join(input, name), join(ctx.stepDir, "files", name), {
          recursive: true,
        })
        outputs.push(relOut(base, "files", name))
      }
    }
    return { outputs }
  },
})
