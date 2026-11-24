import { useCallback } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { inboxItemSchema } from "@workspace/contracts"
import { useOptionalFlowsClient, useSubscription } from "@workspace/sdk-react"

const TITLE = {
  approval: "Approval needed",
  permission: "Permission needed",
  question: "Question from an agent",
  plan_review: "Plan needs review",
  sign_in: "Sign-in needed",
} as const

/** In-app toast when a run asks for a decision; the node shows it too. */
export function InboxToasts() {
  const client = useOptionalFlowsClient()
  return client ? <InboxToastsLive /> : null
}

function InboxToastsLive() {
  const navigate = useNavigate()
  const onUpdate = useCallback(
    (params: unknown) => {
      const p = params as { kind?: string; item?: unknown }
      if (p?.kind !== "item_added") return
      const parsed = inboxItemSchema.safeParse(p.item)
      if (!parsed.success || parsed.data.status !== "open") return
      const item = parsed.data
      const to =
        item.kind !== "sign_in" && item.workflowId
          ? `/workflows/${item.workflowId}?run=${item.runId}`
          : "/inbox"
      toast(TITLE[item.kind], {
        id: item.id,
        description: item.question,
        action: { label: "Review", onClick: () => void navigate(to) },
      })
    },
    [navigate]
  )
  useSubscription("inbox", onUpdate)
  return null
}
