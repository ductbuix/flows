import { useEffect, useState } from "react"
import {
  runChangesResponseSchema,
  type ChangeSet,
  type RunDetail,
} from "@workspace/shared"
import {
  CodeBlock,
  CodeBlockContent,
} from "@workspace/ui/components/code-block"
import { ImpactBadge } from "@/components/ImpactBadge"
import { PageSection } from "@/components/page"
import { api } from "@/lib/api"
import { SummaryMarkdown } from "./SummaryMarkdown"

type Props = {
  run: RunDetail
}

type ConnDiff = {
  connection: string
  previewMd: string
  changeSet: ChangeSet
}

/** Local unpublished work-copy diffs per connection (DES-025 / BL-051). */
export function UnpublishedChanges({ run }: Props) {
  const localConnections = [
    ...new Set(
      (run.effects ?? [])
        .filter((e) => e.impact === "local")
        .map((e) => e.connection)
    ),
  ].sort()
  const [diffs, setDiffs] = useState<ConnDiff[]>([])

  useEffect(() => {
    if (localConnections.length === 0) {
      setDiffs([])
      return
    }
    let alive = true
    void (async () => {
      const next: ConnDiff[] = []
      for (const connection of localConnections) {
        const res = await api.runs[":runId"].changes[":connectionId"].$get({
          param: { runId: run.id, connectionId: connection },
        })
        if (!alive || !res.ok) continue
        const body = runChangesResponseSchema.parse(await res.json())
        if (body.changeSet.ops.length === 0) continue
        next.push({
          connection,
          previewMd: body.previewMd,
          changeSet: body.changeSet,
        })
      }
      if (alive) setDiffs(next)
    })()
    return () => {
      alive = false
    }
    // localConnections is derived from run.effects; re-fetch when effects change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [run.id, run.effects])

  if (diffs.length === 0) return null

  return (
    <PageSection title="Unpublished local changes">
      <div className="flex flex-col gap-4" data-testid="unpublished-changes">
        {diffs.map((diff) => (
          <div
            key={diff.connection}
            className="flex flex-col gap-2"
            data-testid={`unpublished-${diff.connection}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm">{diff.connection}</span>
              <ImpactBadge impact="local" />
            </div>
            <SummaryMarkdown text={diff.previewMd} />
            <CodeBlock size="sm">
              <CodeBlockContent wrap className="max-h-48">
                {diff.changeSet.ops
                  .map(
                    (op) =>
                      `${op.op} ${op.target}${op.destructive ? " (destructive)" : ""}: ${op.summary}`
                  )
                  .join("\n")}
              </CodeBlockContent>
            </CodeBlock>
          </div>
        ))}
      </div>
    </PageSection>
  )
}
