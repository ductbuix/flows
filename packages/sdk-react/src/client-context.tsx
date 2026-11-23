import { createContext, useContext, type ReactNode } from "react"
import type { FlowsClient } from "@workspace/sdk"

const FlowsClientContext = createContext<FlowsClient | null>(null)

export function FlowsClientProvider({
  client,
  children,
}: {
  client: FlowsClient
  children: ReactNode
}) {
  return (
    <FlowsClientContext.Provider value={client}>
      {children}
    </FlowsClientContext.Provider>
  )
}

export function useFlowsClient(): FlowsClient {
  const client = useContext(FlowsClientContext)
  if (!client) {
    throw new Error("useFlowsClient requires FlowsClientProvider")
  }
  return client
}
