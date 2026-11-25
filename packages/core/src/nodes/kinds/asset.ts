import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent } from "../types.ts"
import {
  assetSettings,
  emitFixedPath,
  emitLibraryItems,
  fail,
  producedBody,
  type Settings,
} from "../asset-items.ts"
import { emitFixedResources } from "../asset-resources.ts"

/**
 * Asset (DES-041 / BL-135): fixed reads a pinned library version or card
 * asset via DocumentStore; produced writes the step input to run outputs.
 * Mode follows the mockup: inputs → produced, else fixed.
 */
export const assetKind = defineNodeKind({
  kind: "asset",
  settings: assetSettings,
  ports: { in: ["any"], out: ["text", "image", "file"] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    const parsed = assetSettings.parse(ctx.settings)
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

    if ((parsed.items ?? []).length > 0) {
      yield* emitLibraryItems(runCtx)
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

    yield fail("asset has no library items to read")
  },
})
