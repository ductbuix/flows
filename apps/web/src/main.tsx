import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, HashRouter } from "react-router"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { FlowsClientProvider } from "@workspace/sdk-react"
import type { FlowsClient } from "@workspace/sdk"

import "@workspace/ui/globals.css"
import { App } from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { createAppClient, isDesktopRenderer } from "@/lib/create-app-client.ts"
import { applyTextSize, readTextSize } from "@/lib/text-size.ts"

applyTextSize(readTextSize())

const Router = isDesktopRenderer() ? HashRouter : BrowserRouter

function WithClient({ client }: { client: FlowsClient }) {
  return (
    <FlowsClientProvider client={client}>
      <App />
    </FlowsClientProvider>
  )
}

async function boot() {
  const client = await createAppClient()
  if (client) {
    try {
      await client.ready
    } catch {
      // Pages that need FCP show their own error; rest of the app still loads.
    }
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Router>{client ? <WithClient client={client} /> : <App />}</Router>
        </TooltipProvider>
      </ThemeProvider>
    </StrictMode>
  )
}

void boot()
