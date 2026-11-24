import { SkillSlug } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { errorMessage, isConflictError } from "@/lib/fcp-error"

export type SkillActionResult = "ok" | "conflict" | string

export async function installSkill(
  client: FlowsClient,
  params: { sourceId: string; slug: string; version: number }
): Promise<SkillActionResult> {
  try {
    await client.call("skill/install", {
      ...params,
      slug: SkillSlug.parse(params.slug),
    })
    return "ok"
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}

export async function uninstallSkill(
  client: FlowsClient,
  slug: string
): Promise<SkillActionResult> {
  try {
    await client.call("skill/uninstall", { slug: SkillSlug.parse(slug) })
    return "ok"
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}

/** Replace an installed copy: uninstall then install at the new version. */
export async function updateSkill(
  client: FlowsClient,
  params: { sourceId: string; slug: string; version: number }
): Promise<SkillActionResult> {
  const removed = await uninstallSkill(client, params.slug)
  if (removed !== "ok") return removed
  return installSkill(client, params)
}

export async function saveSources(
  client: FlowsClient,
  sources: string[]
): Promise<SkillActionResult> {
  try {
    await client.call("skill/save", {
      sources,
      requestKey: crypto.randomUUID(),
    })
    return "ok"
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}
