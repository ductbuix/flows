import { Check, X } from "lucide-react"
import { Link } from "react-router"
import type { WireInboxItem } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"

type PlanReviewItem = Extract<WireInboxItem, { kind: "plan_review" }>

export function InboxPlanReviewActions({
  item,
  busy,
  onAccept,
  onReject,
  onDismiss,
}: {
  item: PlanReviewItem
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onDismiss: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {item.overview ? (
        <p className="text-sm text-muted-foreground">{item.overview}</p>
      ) : null}
      <pre className="max-h-48 overflow-auto rounded-xl bg-muted/40 p-3 text-sm whitespace-pre-wrap">
        {item.plan}
      </pre>
      {item.todos.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {item.todos.map((todo) => (
            <li key={todo.id} className="flex gap-2">
              <span className="text-muted-foreground">{todo.status}</span>
              <span>{todo.content}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={busy}
          onClick={onAccept}
          data-testid={`inbox-accept-${item.id}`}
        >
          <Check />
          Accept
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={onReject}
          data-testid={`inbox-reject-${item.id}`}
        >
          <X />
          Reject
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={onDismiss}
          data-testid={`inbox-dismiss-${item.id}`}
        >
          Dismiss
        </Button>
        {item.workflowId ? (
          <Button
            variant="ghost"
            className="ml-auto"
            nativeButton={false}
            render={
              <Link to={`/workflows/${item.workflowId}?run=${item.runId}`} />
            }
          >
            Open run
          </Button>
        ) : null}
      </div>
    </div>
  )
}
