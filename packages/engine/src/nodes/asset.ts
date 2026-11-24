import {
  existsSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { entityIdSegment } from "../library-paths.ts"
import { readResourcesJson } from "../library.ts"
import { defineExecutor } from "./define.ts"
import { relOut } from "./step-paths.ts"

/**
 * Asset (DES-032, BL-082): no process. The run pinned the resources at
 * start; the step emits the pinned folders on `file` and a short index
 * (title, source, revision) on `text`.
 */
export const assetExecutor = defineExecutor({
  kind: "asset",
  run(ctx) {
    if (ctx.node.kind !== "asset") throw new Error("not an asset node")
    const pins = readResourcesJson(ctx.runRoot)?.pins ?? []
    rmSync(ctx.stepDir, { recursive: true, force: true })
    mkdirSync(ctx.stepDir, { recursive: true })
    const base = relOut("nodes", ctx.node.id, `pass-${ctx.pass}`)
    const outputs = [relOut(base, "text.md")]
    const lines: string[] = []
    for (const r of ctx.node.resources) {
      const pin = pins.find(
        (p) =>
          p.connection === r.connection &&
          p.kind === r.entity &&
          p.entityId === r.id
      )
      if (!pin) {
        throw new Error(
          `resource not pinned: ${r.connection}/${r.entity}/${r.id}`
        )
      }
      const seg = entityIdSegment(r.id)
      const source = join(ctx.runRoot, "resources", r.connection, r.entity, seg)
      if (!existsSync(source)) {
        throw new Error(
          `pinned folder missing: ${r.connection}/${r.entity}/${r.id}`
        )
      }
      const linkDir = join(ctx.stepDir, "files", r.connection, r.entity)
      mkdirSync(linkDir, { recursive: true })
      symlinkSync(source, join(linkDir, seg))
      outputs.push(relOut(base, "files", r.connection, r.entity, seg))
      lines.push(
        `- ${pin.title ?? r.id} (${r.connection}/${r.entity}/${r.id}), revision ${pin.revision}`
      )
    }
    writeFileSync(join(ctx.stepDir, "text.md"), lines.join("\n") + "\n")
    return { outputs }
  },
})
