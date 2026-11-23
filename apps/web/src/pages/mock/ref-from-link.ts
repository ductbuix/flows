import type { Ref } from "./docket-data"

/** Source name from a link: known hosts get a short name, others show the host. */
export function refFromLink(link: string): Ref | null {
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, "")
  const system = host.endsWith("github.com")
    ? "github"
    : host.endsWith("rallydev.com")
      ? "rally"
      : host
  const path = url.pathname === "/" ? "" : url.pathname
  return { system, url: url.href, label: `${host}${path}` }
}
