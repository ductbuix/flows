import { useState } from "react"
import { Check, X } from "lucide-react"
import { Link } from "react-router"
import { toast } from "sonner"
import type { WireInboxItem } from "@workspace/contracts"
import { useFlowsClient } from "@workspace/sdk-react"
import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item"
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
    <Item
      variant="outline"
      size="sm"
      className="nodrag nopan nowheel pointer-events-auto flex-col items-stretch bg-warning/15 ring-warning/25"
      data-testid={`node-inbox-${item.nodeId}`}
    >
      <ItemContent>
        <ItemTitle>{item.question}</ItemTitle>
        {item.kind === "permission" ? (
          <ItemDescription>Tool: {item.tool}</ItemDescription>
        ) : null}
      </ItemContent>
      <ItemActions className="flex-wrap">
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
      </ItemActions>
    </Item>
  )
}
