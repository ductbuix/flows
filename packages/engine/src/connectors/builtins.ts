import { confluenceConnector } from "./confluence/index.ts"
import { githubConnector } from "./github/index.ts"
import { registerConnector } from "./registry.ts"

/** Register in-repo connectors used at runtime (not the test-only fake). */
export function registerBuiltinConnectors(): void {
  registerConnector(githubConnector)
  registerConnector(confluenceConnector)
}
