import { useState } from "react"
import { Check, X } from "lucide-react"
import { Link } from "react-router"
import type { WireInboxItem } from "@workspace/contracts"
import { useFlowsClient } from "@workspace/sdk-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { RelativeTime } from "@/components/data/RelativeTime"
import { mono } from "@/components/data/mono"
import { answerInboxItem, dismissInboxItem } from "./inbox-actions"

export function InboxItemCard({
  item,
  onConflict,
  onError,
}: {
  item: WireInboxItem
  onConflict: () => void
  onError: (message: string) => void
}) {
  const client = useFlowsClient()
  const [busy, setBusy] = useState(false)

  async function answer(optionId: string) {
    setBusy(true)
    const result = await answerInboxItem(client, {
      itemId: item.id,
      optionId,
    })
    setBusy(false)
    if (result === "conflict") onConflict()
    else if (result !== "ok") onError(result)
  }

  async function dismiss() {
    setBusy(true)
    const result = await dismissInboxItem(client, item.id)
    setBusy(false)
    if (result === "conflict") onConflict()
    else if (result !== "ok") onError(result)
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-3xl bg-card p-4 ring-1 ring-foreground/10"
      data-testid={`inbox-item-${item.id}`}
    >
      <div className="flex flex-col gap-1">
        <span className="font-heading text-base font-medium">
          {item.question}
        </span>
        <span className="text-sm text-muted-foreground">
          {item.workflowId ? `${item.workflowId} · ` : null}
          <span className={mono}>{item.runId}</span>
          {` · #${item.pass} · `}
          <RelativeTime value={item.at} />
        </span>
        {item.kind === "permission" ? (
          <Badge variant="outline" className="w-fit">
            {item.tool}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.kind === "approval" ? (
          <>
            <Button
              disabled={busy}
              onClick={() => void answer("approved")}
              data-testid={`inbox-approve-${item.id}`}
            >
              <Check />
              Approve
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void answer("rejected")}
              data-testid={`inbox-reject-${item.id}`}
            >
              <X />
              Reject
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={busy}
              onClick={() => void answer("allow-once")}
              data-testid={`inbox-allow-once-${item.id}`}
            >
              <Check />
              Allow once
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void answer("allow-always")}
              data-testid={`inbox-allow-always-${item.id}`}
            >
              Always allow
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void answer("reject-once")}
              data-testid={`inbox-reject-${item.id}`}
            >
              <X />
              Reject
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void dismiss()}
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
              <Link
                to={`/mock/workflows/${item.workflowId}?run=${item.runId}`}
              />
            }
          >
            Open run
          </Button>
        ) : null}
      </div>
    </div>
  )
}
