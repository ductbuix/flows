import { z } from "zod"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent, StepInput } from "../types.ts"

const resourceSchema = z.object({
  connection: z.string().min(1),
  entity: z.string().min(1),
  id: z.string().min(1),
})

const settings = z.object({
  resources: z.array(resourceSchema).default([]),
  access: z.enum(["read", "propose"]).default("read"),
  assetKind: z.enum(["image", "markdown"]).optional(),
  /**
   * Fixed (no inputs): store-relative path of a pinned library file or card
   * asset. Produced (has inputs): output file name under the step folder.
   */
  name: z.string().min(1).optional(),
})

type Settings = z.infer<typeof settings>

type Pin = {
  connection: string
  kind: string
  entityId: string
  revision: string
  title?: string
}

/** Entity id as one path segment (matches engine library-paths). */
function entityIdSegment(entityId: string): string {
  return entityId.replaceAll("/", "%2F")
}

function fail(message: string): StepEvent {
  return { kind: "failed", reason: "exit", message }
}

function storePathForFixed(runDir: string, name: string): string {
  const n = name.replace(/\\/g, "/").replace(/^\/+/, "")
  if (
    n.startsWith("docket/") ||
    n.startsWith("library/") ||
    n.startsWith("workflows/")
  ) {
    return n
  }
  return `${runDir}/${n}`.replace(/\/+/g, "/")
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/")
  return parts[parts.length - 1] || path
}

function producedBody(inputs: readonly StepInput[]): string {
  const text = inputs.find((i) => i.name === "text.md" && i.text !== undefined)
  if (text?.text !== undefined) return text.text
  const first = inputs.find((i) => i.text !== undefined)
  return first?.text ?? ""
}

function readPins(ctx: StepContext<Settings>): Pin[] {
  const raw = ctx.docs.read(`${ctx.runDir}/resources.json`)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw.text) as { pins?: Pin[] }
    return Array.isArray(parsed.pins) ? parsed.pins : []
  } catch {
    return []
  }
}

async function* emitFixedResources(
  ctx: StepContext<Settings>
): AsyncIterable<StepEvent> {
  const pins = readPins(ctx)
  const lines: string[] = []
  for (const r of ctx.settings.resources) {
    const seg = entityIdSegment(r.id)
    const base = `${ctx.runDir}/resources/${r.connection}/${r.entity}/${seg}`
    const paths = ctx.docs
      .list(`${base}/**`)
      .filter((p) => p.startsWith(`${base}/`))
    const single = paths.length === 0 ? ctx.docs.read(base) : null
    if (paths.length === 0 && !single) {
      yield fail(`pinned folder missing: ${r.connection}/${r.entity}/${r.id}`)
      return
    }
    const pin = pins.find(
      (p) =>
        p.connection === r.connection &&
        p.kind === r.entity &&
        p.entityId === r.id
    )
    if (!pin) {
      yield fail(`resource not pinned: ${r.connection}/${r.entity}/${r.id}`)
      return
    }
    if (single) {
      const rel = `files/${r.connection}/${r.entity}/${seg}`
      yield {
        kind: "output_written",
        path: await ctx.outputs.write(rel, single.text),
      }
    } else {
      for (const path of paths) {
        const suffix = path.slice(base.length + 1)
        if (!suffix || suffix.endsWith("/")) continue
        const body = ctx.docs.read(path)
        if (!body) {
          yield fail(`asset missing: ${path}`)
          return
        }
        const rel = `files/${r.connection}/${r.entity}/${seg}/${suffix}`
        yield {
          kind: "output_written",
          path: await ctx.outputs.write(rel, body.text),
        }
      }
    }
    lines.push(
      `- ${pin.title ?? r.id} (${r.connection}/${r.entity}/${r.id}), revision ${pin.revision}`
    )
  }
  yield {
    kind: "output_written",
    path: await ctx.outputs.write("text.md", lines.join("\n") + "\n"),
  }
  yield { kind: "done" }
}

async function* emitFixedPath(
  ctx: StepContext<Settings>,
  name: string
): AsyncIterable<StepEvent> {
  const path = storePathForFixed(ctx.runDir, name)
  const body = ctx.docs.read(path)
  if (!body) {
    yield fail(`asset missing: ${path}`)
    return
  }
  const outName = basename(path)
  const rel = ctx.settings.assetKind === "image" ? `files/${outName}` : outName
  yield {
    kind: "output_written",
    path: await ctx.outputs.write(rel, body.text),
  }
  yield { kind: "done" }
}

/**
 * Asset (DES-041 / BL-135): fixed reads a pinned library version or card
 * asset via DocumentStore; produced writes the step input to run outputs.
 * Mode follows the mockup: inputs → produced, else fixed.
 */
export const assetKind = defineNodeKind({
  kind: "asset",
  settings,
  ports: { in: ["any"], out: ["text", "image", "file"] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    const parsed = settings.parse(ctx.settings)
    const runCtx = { ...ctx, settings: parsed }

    if (runCtx.inputs.length > 0) {
      const outName = parsed.name?.trim() || "asset.md"
      yield {
        kind: "output_written",
        path: await runCtx.outputs.write(outName, producedBody(runCtx.inputs)),
      }
      yield { kind: "done" }
      return
    }

    if (parsed.resources.length > 0) {
      yield* emitFixedResources(runCtx)
      return
    }

    const name = parsed.name?.trim()
    if (name) {
      yield* emitFixedPath(runCtx, name)
      return
    }

    yield fail("asset has no resources or name to resolve")
  },
})
