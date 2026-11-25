import { useOptionalFlowsClient, useQuery } from "@workspace/sdk-react"
import { SidebarMenuBadge } from "@workspace/ui/components/sidebar"

/** Live inbox count for the sidebar; empty when FCP is down or the inbox is clear. */
export function InboxNavBadge() {
  const client = useOptionalFlowsClient()
  if (!client) {
    return <SidebarMenuBadge data-testid="inbox-badge" />
  }
  return <InboxNavBadgeLive />
}

function InboxNavBadgeLive() {
  const { data } = useQuery("inbox/list", {}, { topics: ["inbox"] })
  const count = data?.items.length ?? 0
  return (
    <SidebarMenuBadge data-testid="inbox-badge">
      {count > 0 ? count : null}
    </SidebarMenuBadge>
  )
}
