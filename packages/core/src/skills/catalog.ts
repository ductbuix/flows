import { SkillSlug } from "@workspace/contracts"
import type { DocumentStore } from "../ports/document-store.ts"
import type { Disposable, FileWatcher } from "../ports/file-watcher.ts"
import type { UpdateBus } from "../updates/update-bus.ts"
import { parseSkillMd } from "./parse.ts"
import {
  SKILL_DIRS,
  SKILL_GLOBS,
  skillDirFromPath,
  skillKey,
  skillSlugFromPath,
  type SkillDir,
  type SkillScope,
  normSkillPath,
} from "./paths.ts"

export type SkillFrom = {
  sourceId: string
  version: number
}

export type SkillSummary = {
  slug: string
  name: string
  description: string
  scope: SkillScope
  dirs: SkillDir[]
  from?: SkillFrom
  problem?: string
}

export type SkillDetail = SkillSummary & { body: string }

export type SkillRoot = {
  scope: SkillScope
  docs: DocumentStore
  watcher: FileWatcher
}

export type SkillCatalogDeps = {
  roots: readonly SkillRoot[]
  bus: UpdateBus
}

type SkillCopy = {
  dir: SkillDir
  name: string
  description: string
  body: string
  from?: SkillFrom
  problem?: string
}

export function createSkillCatalog(deps: SkillCatalogDeps): SkillCatalog {
  return new SkillCatalog(deps)
}

export class SkillCatalog {
  private readonly entries = new Map<string, SkillDetail>()
  private readonly watchDisposables: Disposable[] = []

  constructor(private readonly deps: SkillCatalogDeps) {}

  start(): void {
    this.rebuild()
    for (const root of this.deps.roots) {
      this.watchDisposables.push(
        root.watcher.watch(SKILL_GLOBS, (change) => {
          this.applyChange(root, change.path)
        })
      )
    }
  }

  dispose(): void {
    for (const d of this.watchDisposables) d.dispose()
    this.watchDisposables.length = 0
  }

  rebuild(): void {
    this.entries.clear()
    for (const root of this.deps.roots) {
      this.scanRoot(root)
    }
  }

  list(): SkillSummary[] {
    return [...this.entries.values()]
      .map(toSummary)
      .sort((a, b) =>
        skillKey(a.scope, a.slug).localeCompare(skillKey(b.scope, b.slug))
      )
  }

  get(scope: SkillScope, slug: string): SkillDetail | undefined {
    return this.entries.get(skillKey(scope, slug))
  }

  private scanRoot(root: SkillRoot): void {
    const bySlug = new Map<string, SkillCopy[]>()
    for (const glob of SKILL_GLOBS) {
      for (const path of root.docs.list(glob)) {
        const copy = this.readCopy(root.docs, path)
        if (!copy) continue
        const slug = skillSlugFromPath(path)
        if (!slug || !SkillSlug.safeParse(slug).success) continue
        const list = bySlug.get(slug) ?? []
        list.push(copy)
        bySlug.set(slug, list)
      }
    }
    for (const [slug, copies] of bySlug) {
      this.entries.set(
        skillKey(root.scope, slug),
        mergeCopies(root.scope, slug, copies)
      )
    }
  }

  private applyChange(root: SkillRoot, path: string): void {
    const norm = normSkillPath(path)
    const slug = skillSlugFromPath(norm)
    if (!slug || !SkillSlug.safeParse(slug).success) return

    const copies: SkillCopy[] = []
    for (const dir of SKILL_DIRS) {
      for (const candidate of root.docs.list(`${dir}/skills/**/SKILL.md`)) {
        if (skillSlugFromPath(candidate) !== slug) continue
        const copy = this.readCopy(root.docs, candidate)
        if (copy) copies.push(copy)
      }
    }

    const key = skillKey(root.scope, slug)
    if (copies.length === 0) this.entries.delete(key)
    else this.entries.set(key, mergeCopies(root.scope, slug, copies))

    this.deps.bus.publish("skill/update", { kind: "skills_changed" })
  }

  private readCopy(docs: DocumentStore, path: string): SkillCopy | null {
    const dir = skillDirFromPath(path)
    const slug = skillSlugFromPath(path)
    if (!dir || !slug) return null
    const disk = docs.read(normSkillPath(path)) ?? docs.read(path)
    if (!disk) return null
    const parsed = parseSkillMd(disk.text, slug)
    return {
      dir,
      name: parsed.name,
      description: parsed.description,
      body: parsed.body,
      from: parsed.from,
      problem: parsed.problem,
    }
  }
}

function mergeCopies(
  scope: SkillScope,
  slug: string,
  copies: SkillCopy[]
): SkillDetail {
  const order = new Map(SKILL_DIRS.map((d, i) => [d, i]))
  const sorted = [...copies].sort(
    (a, b) => (order.get(a.dir) ?? 99) - (order.get(b.dir) ?? 99)
  )
  const dirs = [...new Set(sorted.map((c) => c.dir))]
  const preferred =
    sorted.find((c) => !c.problem && c.description) ?? sorted[0]!
  const problem =
    preferred.problem ??
    (preferred.description ? undefined : "SKILL.md has no description")

  return {
    slug,
    name: preferred.name || slug,
    description: preferred.description,
    scope,
    dirs,
    body: preferred.body,
    from: preferred.from,
    problem,
  }
}

function toSummary(entry: SkillDetail): SkillSummary {
  return {
    slug: entry.slug,
    name: entry.name,
    description: entry.description,
    scope: entry.scope,
    dirs: entry.dirs,
    from: entry.from,
    problem: entry.problem,
  }
}
