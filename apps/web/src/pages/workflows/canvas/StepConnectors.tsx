import { Plug, Sparkles } from "lucide-react"
import { useQuery } from "@workspace/sdk-react"
import { Badge } from "@workspace/ui/components/badge"
import { useFlow } from "./flow-context"
import { MultiPick } from "./MultiPick"

/** On the node: how many connectors / skills; click opens settings. */
export function ConnectorCount({
  id,
  connectors = [],
  skills = [],
}: {
  id: string
  connectors?: string[]
  skills?: string[]
}) {
  const { openSettings } = useFlow()
  return (
    <button
      type="button"
      className="nodrag flex w-fit gap-1.5"
      onClick={() => openSettings(id)}
      data-testid="step-connectors"
    >
      <Badge variant="secondary">
        <Plug />
        {connectors.length === 0
          ? "No connectors"
          : `${connectors.length} ${connectors.length === 1 ? "connector" : "connectors"}`}
      </Badge>
      <Badge variant="secondary" data-testid="step-skills-count">
        <Sparkles />
        {skills.length === 0
          ? "No skills"
          : `${skills.length} ${skills.length === 1 ? "skill" : "skills"}`}
      </Badge>
    </button>
  )
}

/** In node settings: connectors this step may use (WF-15). */
export function ConnectorList({
  value,
  onChange,
}: {
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const listQ = useQuery("connector/list", {}, { topics: ["connector"] })
  const options = (listQ.data?.items ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    hint: c.transport,
  }))
  return (
    <MultiPick
      options={options}
      value={value}
      onChange={onChange}
      label="Connectors"
      placeholder="Search connectors"
      empty="No connector matches"
    />
  )
}

/** In node settings: skills the step may follow (WF-15). */
export function SkillList({
  value,
  onChange,
}: {
  value: string[]
  onChange: (slugs: string[]) => void
}) {
  const listQ = useQuery("skill/list", {}, { topics: ["skill"] })
  const all = listQ.data?.items ?? []
  const options = all
    .filter(
      (s, i) =>
        !s.problem &&
        all.findIndex((o) => o.slug === s.slug && !o.problem) === i
    )
    .map((s) => ({
      value: s.slug,
      label: s.slug,
      hint: s.dirs.join(", "),
    }))
  return (
    <MultiPick
      options={options}
      value={value}
      onChange={onChange}
      label="Skills"
      placeholder="Search skills"
      empty="No skill matches"
    />
  )
}
