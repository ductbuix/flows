import { useEffect, useState } from "react"
import { SkillSlug } from "@workspace/contracts"
import { useFlowsClient } from "@workspace/sdk-react"

export type SkillUse = {
  workflowId: string
  workflow: string
  node: string
  step: string
}

/** Agent/llm steps that list this skill slug. */
export function useSkillUses(slug: string): SkillUse[] {
  const client = useFlowsClient()
  const [uses, setUses] = useState<SkillUse[]>([])

  useEffect(() => {
    if (!slug) return
    let alive = true
    void (async () => {
      try {
        const list = await client.call("workflow/list", {})
        const found: SkillUse[] = []
        for (const summary of list.items) {
          const detail = await client.call("workflow/get", { id: summary.id })
          const wf = detail.workflow
          if (!wf) continue
          for (const n of wf.nodes) {
            if (n.kind !== "llm" && n.kind !== "agent") continue
            if (!n.skills?.includes(SkillSlug.parse(slug))) continue
            found.push({
              workflowId: summary.id,
              workflow: summary.name ?? summary.id,
              node: n.id,
              step: n.name ?? n.id,
            })
          }
        }
        if (alive) setUses(found)
      } catch {
        if (alive) setUses([])
      }
    })()
    return () => {
      alive = false
    }
  }, [client, slug])

  return slug ? uses : []
}
