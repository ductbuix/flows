import {
  SkillSlug,
  skillInstallMethod,
  skillUninstallMethod,
  type WireSkillDetail,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import type { DocumentStore } from "../ports/document-store.ts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import type { UpdateBus } from "../updates/update-bus.ts"
import type { SkillCatalog, SkillDetail } from "./catalog.ts"
import { formatSkillMd } from "./parse.ts"
import type { SkillDir } from "./paths.ts"

/** Dirs that receive an installed copy (mockup / DES-041). */
export const INSTALL_DIRS: readonly SkillDir[] = [".agents", ".claude"]

export type SkillSourceContent = {
  slug: string
  name: string
  description: string
  body: string
}

/** Reads one skill out of a Library source at a pinned version. */
export type SkillSourceReader = {
  getSkill(
    sourceId: string,
    version: number,
    slug: string
  ): SkillSourceContent | null
}

export type SkillInstallDeps = {
  workspaceDocs: DocumentStore
  catalog: SkillCatalog
  bus: UpdateBus
  sources: SkillSourceReader
}

export type SkillInstallBindings = Pick<
  MethodBindings,
  "skill/install" | "skill/uninstall"
>

export function createSkillInstallBindings(
  deps: SkillInstallDeps
): SkillInstallBindings {
  return {
    "skill/install": defineBinding(skillInstallMethod, (params) => {
      const result = installSkill(deps, params)
      if ("conflict" in result) {
        throw engineError("conflict", "Skill already installed", {
          current: toWireDetail(result.conflict),
        })
      }
      return { skill: toWireDetail(result.skill) }
    }),
    "skill/uninstall": defineBinding(skillUninstallMethod, (params) => {
      uninstallSkill(deps, params.slug)
      return {}
    }),
  }
}

export function installSkill(
  deps: SkillInstallDeps,
  params: { sourceId: string; slug: string; version: number }
): { skill: SkillDetail } | { conflict: SkillDetail } {
  const existing = deps.catalog.get("workspace", params.slug)
  if (existing) {
    return { conflict: existing }
  }

  const source = deps.sources.getSkill(
    params.sourceId,
    params.version,
    params.slug
  )
  if (!source) {
    throw engineError(
      "not_found",
      `Skill not found in source: ${params.sourceId}@${params.version}/${params.slug}`
    )
  }

  const from = { sourceId: params.sourceId, version: params.version }
  const text = formatSkillMd({
    name: source.name,
    description: source.description,
    body: source.body,
    from,
  })

  for (const dir of INSTALL_DIRS) {
    const path = skillMdPath(dir, params.slug)
    const written = deps.workspaceDocs.write(path, text)
    if (!written.ok) {
      throw engineError("conflict", `Could not write ${path}`)
    }
  }

  refreshCatalog(deps)
  const skill = deps.catalog.get("workspace", params.slug)
  if (!skill) {
    throw engineError("internal", "Install wrote files but catalog missed them")
  }
  return { skill }
}

export function uninstallSkill(deps: SkillInstallDeps, slug: string): void {
  const existing = deps.catalog.get("workspace", slug)
  if (!existing?.from) {
    throw engineError(
      "not_found",
      `Installed skill not found: workspace/${slug}`
    )
  }

  for (const dir of INSTALL_DIRS) {
    deps.workspaceDocs.remove(skillMdPath(dir, slug))
  }

  refreshCatalog(deps)
}

function refreshCatalog(deps: SkillInstallDeps): void {
  deps.catalog.rebuild()
  deps.bus.publish("skill/update", { kind: "skills_changed" })
}

function skillMdPath(dir: SkillDir, slug: string): string {
  return `${dir}/skills/${slug}/SKILL.md`
}

function toWireDetail(entry: SkillDetail): WireSkillDetail {
  return {
    slug: SkillSlug.parse(entry.slug),
    name: entry.name,
    description: entry.description,
    scope: entry.scope,
    dirs: entry.dirs,
    body: entry.body,
    ...(entry.from !== undefined ? { from: entry.from } : {}),
    problem: entry.problem,
  }
}

/** In-memory SkillSourceReader for tests. */
export function createFakeSkillSources(
  entries: ReadonlyArray<{
    sourceId: string
    version: number
    skill: SkillSourceContent
  }>
): SkillSourceReader {
  const map = new Map<string, SkillSourceContent>()
  for (const e of entries) {
    map.set(`${e.sourceId}@${e.version}/${e.skill.slug}`, e.skill)
  }
  return {
    getSkill(sourceId, version, slug) {
      return map.get(`${sourceId}@${version}/${slug}`) ?? null
    },
  }
}
