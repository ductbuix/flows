import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { StatusPill, type Tone } from "@/components/brand/StatusPill"
import { mono } from "@/components/data/mono"
import type { LibItem } from "./library-data"
import type { Skill, SourceSkill } from "./skills-data"
import { readers } from "./skills-store"

export type Pick = { slug: string; sourceId?: string; scope?: Skill["scope"] }

/** Update available when the source moved past the version the copy was taken from. */
export function statusOf(
  s: Skill,
  items: LibItem[]
): { tone: Tone; label: string } {
  if (s.problem) return { tone: "failed", label: "Invalid" }
  if (!s.from) return { tone: "idle", label: "Read-only" }
  const cur =
    items.find((i) => i.id === s.from?.sourceId)?.current ?? s.from.version
  return cur > s.from.version
    ? { tone: "attention", label: "Update available" }
    : { tone: "done", label: `Installed v${s.from.version}` }
}

function Cli({ name, on }: { name: string; on: string | null | boolean }) {
  return (
    <Badge
      variant={on ? "secondary" : "outline"}
      className={on ? "" : "text-muted-foreground line-through"}
    >
      {name}
    </Badge>
  )
}

const where = (s: Skill) =>
  `${s.scope === "home" ? "~" : "."}/${s.dirs.map((d) => `${d}`).join(" + ")}/skills`

export function InstalledTable({
  skills,
  items,
  onPick,
}: {
  skills: Skill[]
  items: LibItem[]
  onPick: (p: Pick) => void
}) {
  return (
    <Table data-testid="skills-installed">
      <TableHeader>
        <TableRow>
          <TableHead>Skill</TableHead>
          <TableHead>Where</TableHead>
          <TableHead>Read by</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {skills.map((s) => {
          const r = readers(s, skills)
          const st = statusOf(s, items)
          return (
            <TableRow
              key={`${s.scope}-${s.slug}`}
              className="cursor-pointer"
              onClick={() => onPick({ slug: s.slug, scope: s.scope })}
              data-testid={`skill-row-${s.scope}-${s.slug}`}
            >
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{s.slug}</span>
                  <span className="max-w-96 truncate text-xs text-muted-foreground">
                    {s.description || "No description"}
                  </span>
                </div>
              </TableCell>
              <TableCell className={`${mono} text-xs text-muted-foreground`}>
                {where(s)}
              </TableCell>
              <TableCell>
                <div className="flex gap-1.5">
                  <Cli name="Cursor" on={r.cursor} />
                  <Cli name="Claude Code" on={r.claude} />
                </div>
              </TableCell>
              <TableCell>
                <StatusPill tone={st.tone}>{st.label}</StatusPill>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function AvailableTable({
  rows,
  installed,
  onPick,
}: {
  rows: (SourceSkill & { sourceId: string; source: string })[]
  installed: Skill[]
  onPick: (p: Pick) => void
}) {
  return (
    <Table data-testid="skills-available">
      <TableHeader>
        <TableRow>
          <TableHead>Skill</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const has = installed.some(
            (s) => s.scope === "workspace" && s.slug === r.slug
          )
          return (
            <TableRow
              key={`${r.sourceId}-${r.slug}`}
              className="cursor-pointer"
              onClick={() => onPick({ slug: r.slug, sourceId: r.sourceId })}
              data-testid={`skill-available-${r.slug}`}
            >
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{r.slug}</span>
                  <span className="max-w-96 truncate text-xs text-muted-foreground">
                    {r.description}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {r.source}
              </TableCell>
              <TableCell>
                <StatusPill tone={has ? "done" : "idle"}>
                  {has ? "Installed" : "Not installed"}
                </StatusPill>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
