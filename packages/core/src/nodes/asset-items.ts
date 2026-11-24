import { z } from "zod"
import { safeParseLibItemYaml } from "@workspace/contracts"
import type { StepContext, StepEvent, StepInput } from "./types.ts"

const resourceSchema = z.object({
  connection: z.string().min(1),
  entity: z.string().min(1),
  id: z.string().min(1),
})

export const assetSettings = z.object({
  resources: z.array(resourceSchema).default([]),
  access: z.enum(["read", "propose"]).default("read"),
  /** Library item ids; each emits its current version. */
  items: z.array(z.string().min(1)).optional(),
  assetKind: z.enum(["image", "markdown"]).optional(),
  /**
   * Fixed (no inputs): store-relative path of a pinned library file or card
   * asset. Produced (has inputs): output file name under the step folder.
   */
  name: z.string().min(1).optional(),
})

export type Settings = z.infer<typeof assetSettings>

export function fail(message: string): StepEvent {
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

export function producedBody(inputs: readonly StepInput[]): string {
  const text = inputs.find((i) => i.name === "text.md" && i.text !== undefined)
  if (text?.text !== undefined) return text.text
  const first = inputs.find((i) => i.text !== undefined)
  return first?.text ?? ""
}

const TEXT_FILE = /\.(md|markdown|txt)$/i

/**
 * Library items picked on the canvas: files of each item's current version
 * go under `files/<id>/`, and text.md joins the text files for prompts.
 */
export async function* emitLibraryItems(
  ctx: StepContext<Settings>
): AsyncIterable<StepEvent> {
  const parts: string[] = []
  for (const id of ctx.settings.items ?? []) {
    const disk = ctx.docs.read(`library/${id}/item.yaml`)
    const parsed = disk ? safeParseLibItemYaml(disk.text) : null
    if (!parsed?.success) {
      yield fail(`library item missing: ${id}`)
      return
    }
    const item = parsed.data
    const prefix = `library/${id}/v${item.current}/`
    const files: Record<string, string> = {}
    for (const path of ctx.docs.list(`${prefix}**`)) {
      const rel = path.replace(/^\//, "").slice(prefix.length)
      if (!rel || rel.endsWith(".version.yaml")) continue
      const body = ctx.docs.read(path)
      if (body) files[rel] = body.text
    }
    const texts: string[] = []
    for (const [rel, body] of Object.entries(files).sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      yield {
        kind: "output_written",
        path: await ctx.outputs.write(`files/${id}/${rel}`, body),
      }
      if (TEXT_FILE.test(rel)) texts.push(body.trimEnd())
    }
    parts.push(
      [`## ${item.title} (v${item.current})`, ...texts].join("\n\n") + "\n"
    )
  }
  yield {
    kind: "output_written",
    path: await ctx.outputs.write("text.md", parts.join("\n")),
  }
  yield { kind: "done" }
}

export async function* emitFixedPath(
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
