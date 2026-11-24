import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import type { StepInput } from "@workspace/core"
import type { ExecContext } from "./define.ts"

/** Mirror process.writeInputs for the ACP attempt folder. */
export function writeAttemptInputs(ctx: ExecContext, inputDir: string): void {
  mkdirSync(inputDir, { recursive: true })
  const parts: string[] = []
  for (const input of ctx.inputs) {
    const name =
      ctx.graph.nodes.find((n) => n.id === input.nodeId)?.name ?? input.nodeId
    const textPath = join(input.dir, "text.md")
    if (existsSync(textPath)) {
      parts.push(`## ${name}\n\n${readFileSync(textPath, "utf8").trimEnd()}\n`)
    }
    const files = join(input.dir, "files")
    if (existsSync(files)) {
      mkdirSync(join(inputDir, "files"), { recursive: true })
      symlinkSync(files, join(inputDir, "files", input.nodeId))
    }
  }
  writeFileSync(join(inputDir, "text.md"), parts.join("\n"))
}

/** Upstream step files as ContentBlock resources (DES-041). */
export function inputsAsStepInputs(ctx: ExecContext): StepInput[] {
  const out: StepInput[] = []
  for (const input of ctx.inputs) {
    const textPath = join(input.dir, "text.md")
    if (existsSync(textPath)) {
      out.push({
        from: input.nodeId,
        path: textPath,
        name: "text.md",
        text: readFileSync(textPath, "utf8"),
      })
    }
    const filesDir = join(input.dir, "files")
    if (!existsSync(filesDir)) continue
    for (const name of readdirSync(filesDir)) {
      const p = join(filesDir, name)
      out.push({
        from: input.nodeId,
        path: p,
        name: `files/${name}`,
        text: readFileSync(p, "utf8"),
      })
    }
  }
  return out
}
