import { useState } from "react"
import { Check, Inbox, X } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Page, PageTitle } from "@/components/page"
import { CARDS } from "./docket-data"
import { decideRun, useRuns } from "./runs-store"
import type { MockRun } from "./workflows-data"
import { getFlow, useWorkflows } from "./workflows-store"

function Item({ run }: { run: MockRun }) {
  const workflow = useWorkflows().find((w) => w.id === run.workflowId)
  const card = CARDS.find((c) => c.id === run.cardId)
  const question =
    getFlow(run.workflowId).nodes.find((n) => n.type === "approval")?.data
      .question || "Continue?"
  const decided = !!run.decision
  const [note, setNote] = useState("")
  return (
    <div
      className={`flex flex-col gap-3 rounded-3xl bg-card p-4 ring-1 ring-foreground/10 ${decided ? "opacity-70" : ""}`}
      data-testid={`inbox-item-${run.id}`}
    >
      <div className="flex flex-col gap-1">
        <span className="font-heading text-base font-medium">{question}</span>
        <span className="text-sm text-muted-foreground">
          {workflow?.name} · {card?.title} · #{run.attempt} · {run.ago}
        </span>
      </div>
      {decided ? null : (
        <div className="rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">
          Before this step: mock output of attempt #{run.attempt}. The run
          continues only if you approve.
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(run.inputs).map(([k, v]) => (
          <Badge key={k} variant="outline">
            {k}: {v}
          </Badge>
        ))}
      </div>
      {decided ? (
        run.note ? (
          <p className="text-sm text-muted-foreground">Note: {run.note}</p>
        ) : null
      ) : (
        <Input
          aria-label="Note"
          placeholder="Add a note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}
      <div className="flex items-center gap-2">
        {decided ? (
          <Badge
            variant={run.decision === "approved" ? "secondary" : "destructive"}
          >
            {run.decision === "approved" ? "Approved" : "Rejected"}
          </Badge>
        ) : (
          <>
            <Button
              onClick={() =>
                decideRun(run.id, "approved", note.trim() || undefined)
              }
              data-testid={`inbox-approve-${run.id}`}
            >
              <Check />
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                decideRun(run.id, "rejected", note.trim() || undefined)
              }
              data-testid={`inbox-reject-${run.id}`}
            >
              <X />
              Reject
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          className="ml-auto"
          nativeButton={false}
          render={
            <Link to={`/mock/workflows/${run.workflowId}?run=${run.id}`} />
          }
        >
          Open run
        </Button>
      </div>
    </div>
  )
}

export function InboxPage() {
  const runs = useRuns()
  const waiting = runs.filter((r) => r.tone === "attention" && !r.decision)
  const decided = runs.filter((r) => r.decision)
  return (
    <Page
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Inbox" }]}
      data-testid="mock-inbox-page"
    >
      <PageTitle
        title="Inbox"
        description="Runs waiting for you to approve or reject a step. Mock data."
      />
      <h2 className="font-heading text-base font-medium">
        Needs you
        <span className="ml-2 text-muted-foreground">{waiting.length}</span>
      </h2>
      {waiting.length === 0 ? (
        <Empty className="ring-1 ring-foreground/10" data-testid="inbox-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>Nothing needs you</EmptyTitle>
            <EmptyDescription>
              Approvals from runs show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex max-w-2xl flex-col gap-3">
          {waiting.map((r) => (
            <Item key={r.id} run={r} />
          ))}
        </div>
      )}
      {decided.length > 0 ? (
        <>
          <h2 className="font-heading text-base font-medium">Decided</h2>
          <div className="flex max-w-2xl flex-col gap-3">
            {decided.map((r) => (
              <Item key={r.id} run={r} />
            ))}
          </div>
        </>
      ) : null}
    </Page>
  )
}
