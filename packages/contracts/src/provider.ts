import { parse as parseYaml, stringify as stringifyYaml } from "yaml"
import { z } from "zod"
import { connectionIdSchema } from "./connection.ts"

/** Provider id: same slug rule as connections. */
export const providerIdSchema = connectionIdSchema

/** Type icon of the items a provider makes (Library mockup). */
export const providerIconSchema = z.enum([
  "repo",
  "confluence",
  "rally",
  "ci",
  "logs",
  "web",
  "image",
  "html",
  "other",
])

export type ProviderIcon = z.infer<typeof providerIconSchema>

export const providerAccessSchema = z.enum(["read", "readwrite"])
export type ProviderAccess = z.infer<typeof providerAccessSchema>

/**
 * Regex source must compile and include a named group `id`
 * (BL-171 / library mockup). Failures surface as `invalid_params`.
 */
export function assertProviderPattern(pattern: string): void {
  let compiled: RegExp
  try {
    compiled = new RegExp(pattern, "i")
  } catch {
    throw new Error("invalid regex")
  }
  if (!/\(\?<id>/.test(compiled.source)) {
    throw new Error("pattern needs named group id")
  }
}

export const providerPatternSchema = z
  .string()
  .min(1)
  .superRefine((pattern, ctx) => {
    try {
      assertProviderPattern(pattern)
    } catch (err) {
      ctx.addIssue({
        code: "custom",
        message: err instanceof Error ? err.message : "invalid pattern",
      })
    }
  })

/**
 * A provider is data, not code: how to recognise a link, what a fetch
 * writes, and which tags it adds (DES-041 / library-providers mockup).
 */
export const providerDescriptorSchema = z.strictObject({
  id: providerIdSchema,
  label: z.string().min(1),
  icon: providerIconSchema,
  pattern: providerPatternSchema,
  example: z.string(),
  layout: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string().min(1)),
  access: providerAccessSchema,
  fetch: z.string().min(1),
  custom: z.boolean().optional(),
})

export type ProviderDescriptor = z.infer<typeof providerDescriptorSchema>

/** Presets that ship with the app; a workspace starts with these three. */
export const DEFAULT_PROVIDERS: readonly ProviderDescriptor[] = [
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
]

export type ProviderMatch = {
  provider: ProviderDescriptor
  id: string
  url: string
  title: string
}

const fill = (t: string, id: string) => t.replaceAll("{id}", id)

export const tagsOf = (m: ProviderMatch) =>
  m.provider.tags.map((t) => fill(t, m.id))

/** First provider whose pattern matches. */
export function detect(
  url: string,
  providers: readonly ProviderDescriptor[]
): ProviderMatch | null {
  const u = url.trim()
  if (!u) return null
  for (const provider of providers) {
    try {
      const m = new RegExp(provider.pattern, "i").exec(u)
      const id = m?.groups?.id
      if (id) {
        return {
          provider,
          id,
          url: u,
          title: `${provider.label} ${id}`,
        }
      }
    } catch {
      // A broken custom pattern never matches.
    }
  }
  return null
}

export function parseProviderYaml(text: string): ProviderDescriptor {
  const raw = parseYaml(text) ?? {}
  return providerDescriptorSchema.parse(raw)
}

export function safeParseProviderYaml(text: string) {
  try {
    const raw = parseYaml(text) ?? {}
    return providerDescriptorSchema.safeParse(raw)
  } catch (err) {
    return providerDescriptorSchema.safeParse({
      __yamlError: err instanceof Error ? err.message : "invalid YAML",
    })
  }
}

export function providerToYaml(provider: ProviderDescriptor): string {
  return stringifyYaml(provider, { lineWidth: 0 })
}
