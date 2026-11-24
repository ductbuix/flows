import type { ConnectorAuth, ConnectorTransport } from "@workspace/contracts"
import { AUTH_FOR } from "@workspace/contracts"

export { AUTH_FOR }

export const TRANSPORT: Record<
  ConnectorTransport,
  { label: string; hint: string; field: string; example: string }
> = {
  mcp: {
    label: "MCP server",
    hint: "A local command or a standard MCP endpoint",
    field: "Command or URL",
    example: "npx -y @modelcontextprotocol/server-github",
  },
  api: {
    label: "API",
    hint: "A REST or GraphQL interface",
    field: "Base URL",
    example: "https://wiki.company.com/rest/api",
  },
  cli: {
    label: "CLI",
    hint: "A command already installed and signed in",
    field: "Binary",
    example: "gh",
  },
}

export const AUTH: Record<ConnectorAuth, { label: string; hint: string }> = {
  cookies: {
    label: "Browser cookies",
    hint: "Sign in once in a window; cookies stay on this machine",
  },
  pat: {
    label: "Access token",
    hint: "A personal access token kept in the keychain",
  },
  oauth: { label: "OAuth", hint: "Approve in the browser" },
  "cli-login": { label: "CLI login", hint: "Uses the CLI's own saved sign-in" },
  none: { label: "No sign-in", hint: "Open endpoint" },
}

export const authLabel = (a: ConnectorAuth) => AUTH[a].label
