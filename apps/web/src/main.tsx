import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, HashRouter } from "react-router"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { FlowsClientProvider } from "@workspace/sdk-react"

import "@workspace/ui/globals.css"
import { App } from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { createAppClient, isDesktopRenderer } from "@/lib/create-app-client.ts"

const client = createAppClient()
const Router = isDesktopRenderer() ? HashRouter : BrowserRouter

const tree = (
  <StrictMode>
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <Router>{client ? <WithClient client={client} /> : <App />}</Router>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)

function WithClient({
  client: flowsClient,
}: {
  client: NonNullable<typeof client>
}) {
  return (
    <FlowsClientProvider client={flowsClient}>
      <App />
    </FlowsClientProvider>
  )
}

createRoot(document.getElementById("root")!).render(tree)
