/**
 * A connector is one way into an outside system. How it connects (transport)
 * and how it proves who you are (auth) are separate choices, so a company that
 * bans tokens and MCP can still use the API with browser cookies.
 */
export type Transport = "mcp" | "api" | "cli"
export type Auth = "cookies" | "pat" | "oauth" | "cli-login" | "none"
export type ConnStatus = "connected" | "expired" | "off"

export const TRANSPORT: Record<
  Transport,
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

export const AUTH: Record<Auth, { label: string; hint: string }> = {
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

/** Which transports can use which sign-ins. */
export const AUTH_FOR: Record<Transport, Auth[]> = {
  mcp: ["oauth", "pat", "none"],
  api: ["cookies", "pat", "oauth"],
  cli: ["cli-login", "pat"],
}

export type Capability = {
  name: string
  desc: string
  /** Changes something on the remote. Off by default. */
  write: boolean
  allowed: boolean
}

export type Connector = {
  id: string
  name: string
  transport: Transport
  /** Command, URL or binary. */
  how: string
  auth: Auth
  status: ConnStatus
  account?: string
  checked: string
  capabilities: Capability[]
  /** Library provider that fetches through this connector. */
  providerId?: string
}

const cap = (
  name: string,
  desc: string,
  write = false,
  allowed = !write
): Capability => ({ name, desc, write, allowed })

export const CONNECTORS: Connector[] = [
  {
    id: "github-cli",
    name: "GitHub",
    transport: "cli",
    how: "gh",
    auth: "cli-login",
    status: "connected",
    account: "ductbuix",
    checked: "2 min ago",
    providerId: "github",
    capabilities: [
      cap("repo clone", "Read repositories"),
      cap("pr view", "Read pull requests and reviews"),
      cap("pr create", "Open a draft pull request", true, true),
      cap("pr merge", "Merge a pull request", true, false),
    ],
  },
  {
    id: "confluence",
    name: "Confluence",
    transport: "api",
    how: "https://wiki.costory.studio/rest/api",
    auth: "cookies",
    status: "expired",
    account: "duc.bui",
    checked: "3 days ago",
    providerId: "confluence",
    capabilities: [
      cap("page read", "Read pages and attachments"),
      cap("search", "Search spaces"),
      cap("page update", "Edit a page's body", true, true),
    ],
  },
  {
    id: "rally",
    name: "Rally",
    transport: "api",
    how: "https://rally1.rallydev.com/slm/webservice",
    auth: "cookies",
    status: "connected",
    account: "duc.bui",
    checked: "yesterday",
    providerId: "rally",
    capabilities: [
      cap("artifact read", "Read stories, defects, features, epics"),
      cap("artifact update", "Change state or add a comment", true, false),
    ],
  },
  {
    id: "jenkins",
    name: "Jenkins",
    transport: "api",
    how: "https://ci.costory.studio",
    auth: "pat",
    status: "connected",
    account: "ci-bot token",
    checked: "1 hour ago",
    capabilities: [
      cap("job read", "Read builds and console logs"),
      cap("build trigger", "Start a build", true, false),
    ],
  },
  {
    id: "opensearch",
    name: "OpenSearch logs",
    transport: "mcp",
    how: "npx -y opensearch-mcp",
    auth: "pat",
    status: "off",
    checked: "never",
    capabilities: [cap("search logs", "Query indices, read only")],
  },
]
