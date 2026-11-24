import type {
  LibItem,
  WireSkillSourceOffer,
  WireSkillSummary,
} from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { StatusPill } from "@/components/brand/StatusPill"
import { mono } from "@/components/data/mono"
import { readers } from "./readers"
import { statusOf, whereLabel } from "./status"

export type SkillPick = {
  slug: string
  scope?: WireSkillSummary["scope"]
  sourceId?: string
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

export function InstalledTable({
  skills,
  items,
  onPick,
}: {
  skills: WireSkillSummary[]
  items: LibItem[]
  onPick: (p: SkillPick) => void
}) {
  const currentOf = (id: string) => items.find((i) => i.id === id)?.current
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
          const st = statusOf(
            s,
            s.from ? currentOf(s.from.sourceId) : undefined
          )
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
                {whereLabel(s)}
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

export type AvailableRow = WireSkillSourceOffer & {
  sourceId: string
  source: string
}

export function AvailableTable({
  rows,
  installed,
  onPick,
}: {
  rows: AvailableRow[]
  installed: WireSkillSummary[]
  onPick: (p: SkillPick) => void
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
