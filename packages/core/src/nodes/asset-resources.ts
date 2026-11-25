import type { StepContext, StepEvent } from "./types.ts"
import { fail, type Settings } from "./asset-items.ts"

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

export async function* emitFixedResources(
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
