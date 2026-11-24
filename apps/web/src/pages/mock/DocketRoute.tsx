import { useOptionalFlowsClient } from "@workspace/sdk-react"
import { DocketLive } from "./DocketLive"
import { DocketPage } from "./DocketPage"

/** Live FCP Docket when a client is wired; otherwise the mock board. */
export function DocketRoute() {
  const client = useOptionalFlowsClient()
  if (client) return <DocketLive />
  return <DocketPage />
}
