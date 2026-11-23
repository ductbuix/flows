import { Link } from "react-router"
import { Plug, Sparkles } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Switch } from "@workspace/ui/components/switch"
import { accessOf } from "./connector-parts"
import type { Connector } from "./connectors-data"
import { useConnectors } from "./connectors-store"
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
  const all = useConnectors()
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((v) => v !== id))
  return (
    <div className="flex flex-col gap-1" data-testid="step-connector-list">
      {all.map((c) => (
        <div key={c.id} className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-muted" data-testid={`step-connector-${c.id}`}>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm">{c.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {problem(c) ? (
                <>
                  {problem(c)} ·{" "}
                  <Link to={`/mock/connectors?connector=${c.id}`} className="underline">
                    Fix
                  </Link>
                </>
              ) : (
                accessOf(c)
              )}
            </span>
          </div>
          <Switch checked={value.includes(c.id)} onCheckedChange={(v) => toggle(c.id, v)} aria-label={`Use ${c.name}`} />
        </div>
      ))}
    </div>
  )
}

/** In node settings: skills the step may follow. Invalid ones are not offered. */
export function SkillList({ value, onChange }: { value: string[]; onChange: (slugs: string[]) => void }) {
  const all = useSkills()
  const shown = all.filter((s, i) => !s.problem && all.findIndex((o) => o.slug === s.slug && !o.problem) === i)
  const toggle = (slug: string, on: boolean) => onChange(on ? [...value, slug] : value.filter((v) => v !== slug))
  return (
    <div className="flex flex-col gap-1" data-testid="step-skill-list">
      {shown.map((s) => {
        const r = readers(s, all)
        return (
          <div key={s.slug} className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-muted" data-testid={`step-skill-${s.slug}`}>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm">{s.slug}</span>
              <span className="truncate text-xs text-muted-foreground">
                {r.cursor && r.claude ? "Cursor and Claude Code" : r.cursor ? "Cursor only" : "Claude Code only"}
              </span>
            </div>
            <Switch checked={value.includes(s.slug)} onCheckedChange={(v) => toggle(s.slug, v)} aria-label={`Use ${s.slug}`} />
          </div>
        )
      })}
    </div>
  )
}
