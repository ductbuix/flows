import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import type { ExecContext } from "./define.ts"
import { relOut } from "./step-paths.ts"

/** The active text inputs joined in edge order, each under its node name. */
export function joinedInputText(ctx: ExecContext): string {
  const parts: string[] = []
  for (const input of ctx.inputs) {
    const name =
      ctx.graph.nodes.find((n) => n.id === input.nodeId)?.name ?? input.nodeId
    const textPath = join(input.dir, "text.md")
    if (existsSync(textPath)) {
      parts.push(`## ${name}\n\n${readFileSync(textPath, "utf8").trimEnd()}\n`)
    }
  }
  return parts.join("\n")
}

/**
 * Forwards what came in (Judge, Approval; DES-034): the step text is
 * `text`, the input files are merged. Returns the output refs.
 */
export function forwardInputs(ctx: ExecContext, text: string): string[] {
  rmSync(join(ctx.stepDir, "text.md"), { force: true })
  rmSync(join(ctx.stepDir, "files"), { recursive: true, force: true })
  mkdirSync(ctx.stepDir, { recursive: true })
  writeFileSync(join(ctx.stepDir, "text.md"), text)
  const base = relOut("nodes", ctx.node.id, `pass-${ctx.pass}`)
  const outputs = [relOut(base, "text.md")]
  for (const input of ctx.inputs) {
    const files = join(input.dir, "files")
    if (!existsSync(files)) continue
    for (const name of readdirSync(files).sort()) {
      cpSync(join(files, name), join(ctx.stepDir, "files", name), {
        recursive: true,
        dereference: true,
      })
      const rel = relOut(base, "files", name)
      if (!outputs.includes(rel)) outputs.push(rel)
    }
  }
  return outputs
}
