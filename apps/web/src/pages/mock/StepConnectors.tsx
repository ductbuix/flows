import { Plug, Sparkles } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { accessOf } from "./connector-parts"
import type { Connector } from "./connectors-data"
import { useConnectors } from "./connectors-store"
import { MultiPick } from "./MultiPick"
import { useFlow } from "./flow-context"
import { readers, useSkills } from "./skills-store"

const problem = (c: Connector) => (c.status === "connected" ? null : c.status === "expired" ? "Sign-in expired" : "Not connected")

/** On the node: only how many connectors the step uses. Clicking opens its settings. */
export function ConnectorCount({ id, ids, skills = [] }: { id: string; ids: string[]; skills?: string[] }) {
  const { openSettings } = useFlow()
  const bad = useConnectors().some((c) => ids.includes(c.id) && problem(c))
  return (
    <button type="button" className="nodrag flex w-fit gap-1.5" onClick={() => openSettings(id)} data-testid="step-connectors">
      <Badge variant={bad ? "destructive" : "secondary"}>
        <Plug />
        {ids.length === 0 ? "No connectors" : `${ids.length} ${ids.length === 1 ? "connector" : "connectors"}`}
      </Badge>
      <Badge variant="secondary" data-testid="step-skills-count">
        <Sparkles />
        {skills.length === 0 ? "No skills" : `${skills.length} ${skills.length === 1 ? "skill" : "skills"}`}
      </Badge>
    </button>
  )
}

/** In node settings: which systems this step may use, within what each connector allows. */
export function ConnectorList({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const options = useConnectors().map((c) => ({ value: c.id, label: c.name, hint: problem(c) ?? accessOf(c) }))
  return <MultiPick options={options} value={value} onChange={onChange} label="Connectors" placeholder="Search connectors" empty="No connector matches" />
}

/** In node settings: skills the step may follow. Invalid ones are not offered. */
export function SkillList({ value, onChange }: { value: string[]; onChange: (slugs: string[]) => void }) {
  const all = useSkills()
  const options = all
    .filter((s, i) => !s.problem && all.findIndex((o) => o.slug === s.slug && !o.problem) === i)
    .map((s) => {
      const r = readers(s, all)
      return { value: s.slug, label: s.slug, hint: r.cursor && r.claude ? "Cursor and Claude Code" : r.cursor ? "Cursor only" : "Claude Code only" }
    })
  return <MultiPick options={options} value={value} onChange={onChange} label="Skills" placeholder="Search skills" empty="No skill matches" />
}
