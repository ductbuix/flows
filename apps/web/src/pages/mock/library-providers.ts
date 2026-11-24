import type { LibItem, LibKind } from "./library-types"

/**
 * A provider is data, not code: how to recognise a link, what a read-only
 * fetch writes into the item's folder, and which tags it adds. New systems
 * (Jenkins, OpenSearch, anything with a CLI or API) are added as a descriptor.
 */
export type Provider = {
  id: string
  label: string
  /** Type icon of the items it makes. */
  icon: LibKind
  /** Regex source with a named group `id`. */
  pattern: string
  example: string
  /** Files a fetch writes, relative to the item folder. */
  layout: string[]
  /** `{id}` is replaced by the remote id. */
  tags: string[]
  /** What the remote allows: read only, or also pushing local changes back. */
  access: "read" | "readwrite"
  /** Command or API call that does the fetch (and the push, when allowed). */
  fetch: string
  custom?: boolean
}

/** Everything the app knows how to add. A workspace starts with the first three. */
export const PRESETS: Provider[] = [
  {
    id: "github",
    label: "GitHub",
    icon: "repo",
    pattern: "github\\.com/(?<id>[^/]+/[^/?#]+)",
    example: "https://github.com/ductbuix/flows",
    layout: ["repo/README.md", "repo/package.json", "repo/src/index.ts"],
    tags: ["repo:{id}", "type:repository"],
    access: "readwrite",
    fetch: "git clone --depth 1 to fetch, git push to write back",
  },
  {
    id: "confluence",
    label: "Confluence",
    icon: "confluence",
    pattern: "confluence[^/]*/.*pages/(?<id>\\d+)",
    example: "https://confluence.example/pages/48213",
    layout: ["page.md", "export.html", "attachments/image-1.png"],
    tags: ["confluence:{id}", "type:page"],
    access: "readwrite",
    fetch:
      "Confluence MCP: page as Markdown to fetch, page update to write back",
  },
  {
    id: "rally",
    label: "Rally",
    icon: "rally",
    pattern: "rally[^/]*/.*?(?<id>(?:US|DE|F|EP|TA)\\d+)",
    example: "https://rally.example/slm/US1234",
    layout: ["ticket.json", "description.md", "attachments/attachment-1.png"],
    tags: ["rally:{id}"],
    access: "read",
    fetch: "Rally web services API: artifact JSON and attachments",
  },
  {
    id: "jenkins",
    label: "Jenkins",
    icon: "ci",
    pattern: "jenkins[^/]*/job/(?<id>[^/]+)",
    example: "https://jenkins.example/job/auth-ci/4412",
    layout: ["build.json", "console.log", "artifacts/junit.xml"],
    tags: ["jenkins:{id}", "type:build"],
    access: "read",
    fetch: "Jenkins JSON API: build info, console text, archived artifacts",
  },
  {
    id: "opensearch",
    label: "OpenSearch",
    icon: "logs",
    pattern: "opensearch[^/]*/(?:.*/)?(?<id>[^/?#]+)",
    example: "https://opensearch.example/dashboards/login-errors",
    layout: ["query.json", "results.ndjson", "summary.md"],
    tags: ["logs:{id}", "type:logs"],
    access: "read",
    fetch: "_search with the saved query, exported as NDJSON",
  },
  {
    id: "web",
    label: "Web page",
    icon: "web",
    pattern: "^https?://(?<id>[^?#]+)",
    example: "https://docs.example/guide",
    layout: ["page.html", "page.md"],
    tags: ["type:web"],
    access: "read",
    fetch: "GET the page, keep HTML and a Markdown copy",
  },
]

export const DEFAULT_PROVIDERS = PRESETS.filter((p) =>
  ["github", "confluence", "rally"].includes(p.id)
)

export type Match = {
  provider: Provider
  id: string
  url: string
  title: string
}

const fill = (t: string, id: string) => t.replace("{id}", id)

export const tagsOf = (m: Match) => m.provider.tags.map((t) => fill(t, m.id))

/** First provider whose pattern matches. Custom ones come before the Web page fallback. */
export function detect(url: string, providers: Provider[]): Match | null {
  const u = url.trim()
  if (!u) return null
  for (const provider of providers) {
    try {
      const m = new RegExp(provider.pattern, "i").exec(u)
      const id = m?.groups?.id
      if (id) return { provider, id, url: u, title: `${provider.label} ${id}` }
    } catch {
      // A broken custom pattern never matches.
    }
  }
  return null
}

export const findExisting = (m: Match | null, items: LibItem[]) =>
  m
    ? items.find((i) => i.source === m.provider.id && i.remoteId === m.id)
    : undefined
