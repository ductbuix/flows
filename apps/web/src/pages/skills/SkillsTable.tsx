import type { WireSkillSummary } from "@workspace/contracts"
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
  scope: WireSkillSummary["scope"]
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
  onPick,
}: {
  skills: WireSkillSummary[]
  onPick: (p: SkillPick) => void
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
          const st = statusOf(s)
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
