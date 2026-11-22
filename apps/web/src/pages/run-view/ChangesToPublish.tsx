import { useEffect, useState } from "react"
import {
  runChangesResponseSchema,
  type ChangeSet,
  type RunDetail,
  type TaskView,
} from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  CodeBlock,
  CodeBlockContent,
} from "@workspace/ui/components/code-block"
import { ImpactBadge } from "@/components/data/ImpactBadge"
import { PageSection } from "@/components/page"
import { api } from "@/lib/api"
import { SummaryMarkdown } from "./SummaryMarkdown"
import { mono } from "@/components/data/mono"

type Props = {
  run: RunDetail
  task: TaskView
}

/** The connection a publish Output node sends to, if the task is one. */
export function publishConnectionOf(
  run: RunDetail,
  taskId: string
): string | undefined {
  const node = run.graph.nodes.find((n) => n.id === taskId)
  return node?.kind === "output" && node.target === "publish"
    ? node.connection
    : undefined
}

function destructiveOps(changeSet: ChangeSet | null): string[] {
  if (!changeSet) return []
  return changeSet.ops
    .filter((op) => op.destructive)
    .map((op) => op.summary || op.target)
}

function opsDiff(changeSet: ChangeSet | null): string {
  if (!changeSet || changeSet.ops.length === 0) return "(no ops)"
  return changeSet.ops
    .map((op) => {
      const payload =
        typeof op.payload === "string"
          ? op.payload
          : JSON.stringify(op.payload, null, 2)
      return `## ${op.op} ${op.target}${op.destructive ? " (destructive)" : ""}\n${op.summary}\n\n${payload}`
    })
    .join("\n\n")
}

/** Waiting publish evidence: preview, diff, Cloud badge (DES-025 J9). */
export function ChangesToPublish({ run, task }: Props) {
  const connection = publishConnectionOf(run, task.id)
  const [previewMd, setPreviewMd] = useState<string | null>(null)
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!connection) return
    let alive = true
    void (async () => {
      const res = await api.runs[":runId"].changes[":connectionId"].$get({
        param: { runId: run.id, connectionId: connection },
      })
      if (!alive) return
      if (!res.ok) {
        setError("Could not load changes to publish.")
        return
      }
      const body = runChangesResponseSchema.parse(await res.json())
      setPreviewMd(body.previewMd)
      setChangeSet(body.changeSet)
      setError(null)
    })()
    return () => {
      alive = false
    }
  }, [run.id, connection])

  if (!connection) return null

  const destructive = destructiveOps(changeSet)

  return (
    <PageSection title="Changes to publish">
      <div className="flex flex-col gap-3" data-testid="changes-to-publish">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${mono} text-sm`}>{connection}</span>
          <ImpactBadge impact="cloud" data-testid="publish-impact" />
        </div>
        {destructive.length > 0 ? (
          <Alert
            variant="destructive"
            data-testid="publish-destructive-warning"
          >
            <AlertTitle>Destructive operations</AlertTitle>
            <AlertDescription>
              This publish includes: {destructive.join(", ")}.
            </AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            {previewMd ? (
              <div data-testid="publish-preview">
                <SummaryMarkdown text={previewMd} />
              </div>
            ) : null}
            <CodeBlock size="sm" data-testid="publish-diff">
              <CodeBlockContent wrap className="max-h-64">
                {opsDiff(changeSet)}
              </CodeBlockContent>
            </CodeBlock>
          </>
        )}
      </div>
    </PageSection>
  )
}
