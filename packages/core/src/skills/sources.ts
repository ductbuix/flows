import { z } from "zod"
import {
  SkillSlug,
  skillListSourcesMethod,
  skillSaveMethod,
  type WireSkillSource,
  type WireSkillSourceOffer,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import { readItemDisk, versionFilePath } from "../library/versions.ts"
import type { DocumentStore } from "../ports/document-store.ts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import type { UpdateBus } from "../updates/update-bus.ts"
import type { SkillSourceContent, SkillSourceReader } from "./install.ts"
import { parseSkillMd } from "./parse.ts"

export const SOURCES_PATH = "skills/sources.json"

const sourcesFileSchema = z.object({
  sources: z.array(z.string().min(1)).default([]),
})

const SKILL_MD_RE = /^library\/([^/]+)\/v(\d+)\/skills\/([^/]+)\/SKILL\.md$/

export type SkillSourcesDeps = {
  docs: DocumentStore
  bus: UpdateBus
}

export type SkillSourcesBindings = Pick<
  MethodBindings,
  "skill/list_sources" | "skill/save"
>

export function createSkillSourcesBindings(
  deps: SkillSourcesDeps
): SkillSourcesBindings {
  return {
    "skill/list_sources": defineBinding(skillListSourcesMethod, () => ({
      items: listSources(deps),
    })),
    "skill/save": defineBinding(skillSaveMethod, (params) => {
      const sources = saveSources(deps, params.sources)
      return { sources }
    }),
  }
}

export function readSourceIds(docs: DocumentStore): string[] {
  const file = docs.read(SOURCES_PATH)
  if (!file) return []
  try {
    const parsed = sourcesFileSchema.safeParse(JSON.parse(file.text))
    return parsed.success ? [...parsed.data.sources] : []
  } catch {
    return []
  }
}

export function saveSources(
  deps: SkillSourcesDeps,
  sources: readonly string[]
): string[] {
  const unique = [...new Set(sources)]
  for (const id of unique) {
    if (!readItemDisk(deps.docs, id)) {
      throw engineError("not_found", `Library item not found: ${id}`)
    }
  }
  const written = deps.docs.write(
    SOURCES_PATH,
    `${JSON.stringify({ sources: unique }, null, 2)}\n`
  )
  if (!written.ok) {
    throw engineError("conflict", "Could not write skill sources")
  }
  deps.bus.publish("skill/update", { kind: "skills_changed" })
  return unique
}

export function listSources(deps: SkillSourcesDeps): WireSkillSource[] {
  return readSourceIds(deps.docs).map((id) => ({
    id,
    skills: listOffers(deps.docs, id),
  }))
}

/** Skills under `skills/` of the item's current version. */
export function listOffers(
  docs: DocumentStore,
  sourceId: string
): WireSkillSourceOffer[] {
  const disk = readItemDisk(docs, sourceId)
  if (!disk) return []
  return listOffersAt(docs, sourceId, disk.current)
}

export function listOffersAt(
  docs: DocumentStore,
  sourceId: string,
  version: number
): WireSkillSourceOffer[] {
  const prefix = `library/${sourceId}/v${version}/skills/`
  const offers: WireSkillSourceOffer[] = []
  for (const path of docs.list(`${prefix}*/SKILL.md`)) {
    const m = SKILL_MD_RE.exec(path.replace(/\\/g, "/").replace(/^\//, ""))
    if (!m || m[1] !== sourceId || Number(m[2]) !== version) continue
    const slug = m[3]!
    const file = docs.read(path)
    if (!file) continue
    const parsed = parseSkillMd(file.text, slug)
    const slugOk = SkillSlug.safeParse(slug)
    if (!slugOk.success) continue
    offers.push({
      slug: slugOk.data,
      name: parsed.name,
      description: parsed.description,
      body: parsed.body,
    })
  }
  return offers.sort((a, b) => a.slug.localeCompare(b.slug))
}

/** Reads SKILL.md out of a Library item version folder. */
export function createLibrarySkillSourceReader(
  docs: DocumentStore
): SkillSourceReader {
  return {
    getSkill(sourceId, version, slug): SkillSourceContent | null {
      const path = versionFilePath(sourceId, version, `skills/${slug}/SKILL.md`)
      const file = docs.read(path)
      if (!file) return null
      const parsed = parseSkillMd(file.text, slug)
      if (parsed.problem && !parsed.description) return null
      return {
        slug,
        name: parsed.name,
        description: parsed.description,
        body: parsed.body,
      }
    },
  }
}
