import { useState } from "react"
import { Check, X } from "lucide-react"
import { Link } from "react-router"
import { toast } from "sonner"
import type { WireInboxItem } from "@workspace/contracts"
import { useFlowsClient } from "@workspace/sdk-react"
import { Button } from "@workspace/ui/components/button"
import { answerInboxItem } from "@/pages/inbox/inbox-actions"

export type NodeInboxItem = Exclude<WireInboxItem, { kind: "sign_in" }>

/** Option buttons answered right on the node; other kinds open the Inbox. */
const OPTIONS: Partial<
  Record<NodeInboxItem["kind"], { id: string; label: string; ok?: boolean }[]>
> = {
  approval: [
    { id: "approved", label: "Approve", ok: true },
    { id: "rejected", label: "Reject" },
  ],
  permission: [
    { id: "allow-once", label: "Allow once", ok: true },
    { id: "allow-always", label: "Always allow" },
    { id: "reject-once", label: "Reject" },
  ],
}

/** Open Inbox ask for this node, answered without leaving the canvas. */
export function NodeInboxPrompt({ item }: { item: NodeInboxItem }) {
  const client = useFlowsClient()
  const [busy, setBusy] = useState(false)
  const options = OPTIONS[item.kind]

  async function answer(optionId: string) {
    setBusy(true)
    const result = await answerInboxItem(client, {
      itemId: item.id,
      optionId,
    })
    setBusy(false)
    if (result !== "ok" && result !== "conflict") toast.error(result)
  }

  return (
    <div
      className="nodrag nopan nowheel pointer-events-auto flex flex-col gap-2 rounded-2xl bg-warning/15 p-3 ring-1 ring-warning/40"
      data-testid={`node-inbox-${item.nodeId}`}
    >
      <p className="text-sm font-medium">{item.question}</p>
      {item.kind === "permission" ? (
        <p className="text-xs text-muted-foreground">Tool: {item.tool}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options ? (
          options.map((o) => (
            <Button
              key={o.id}
              variant={o.ok ? "default" : "outline"}
              disabled={busy}
              data-testid={`node-inbox-${o.id}-${item.nodeId}`}
              onClick={() => void answer(o.id)}
            >
              {o.ok ? <Check /> : o.id.startsWith("reject") ? <X /> : null}
              {o.label}
            </Button>
          ))
        ) : (
          <Button
            nativeButton={false}
            render={<Link to="/inbox" />}
            data-testid={`node-inbox-open-${item.nodeId}`}
          >
            Answer in Inbox
          </Button>
        )}
      </div>
    </div>
  )
}
