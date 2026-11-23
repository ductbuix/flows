import { describe, expect, it } from "vitest"
import {
  DEFAULT_PROVIDERS,
  detect,
  providerDescriptorSchema,
  providerPatternSchema,
  tagsOf,
} from "./provider.ts"

describe("providerPatternSchema", () => {
  it("accepts a pattern with a named group id", () => {
    expect(providerPatternSchema.parse("host/(?<id>[^/]+)")).toBe(
      "host/(?<id>[^/]+)"
    )
  })

  it("rejects an invalid regex as a zod issue", () => {
    const result = providerPatternSchema.safeParse("[")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("invalid regex")
    }
  })

  it("rejects a valid regex without a named group id", () => {
    const result = providerPatternSchema.safeParse("github\\.com/([^/]+)")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "pattern needs named group id"
      )
    }
  })
})

describe("DEFAULT_PROVIDERS link recognition", () => {
  it("ships GitHub, Confluence and Rally", () => {
    expect(DEFAULT_PROVIDERS.map((p) => p.id)).toEqual([
      "github",
      "confluence",
      "rally",
    ])
    for (const p of DEFAULT_PROVIDERS) {
      expect(providerDescriptorSchema.parse(p)).toEqual(p)
    }
  })

  it("recognises a GitHub repo URL", () => {
    const m = detect("https://github.com/ductbuix/flows", DEFAULT_PROVIDERS)
    expect(m).toMatchObject({
      id: "ductbuix/flows",
      provider: { id: "github" },
      title: "GitHub ductbuix/flows",
    })
    expect(tagsOf(m!)).toEqual(["repo:ductbuix/flows", "type:repository"])
  })

  it("recognises a Confluence page URL", () => {
    const m = detect(
      "https://confluence.example/pages/48213",
      DEFAULT_PROVIDERS
    )
    expect(m).toMatchObject({
      id: "48213",
      provider: { id: "confluence" },
    })
  })

  it("recognises a Rally artifact URL", () => {
    const m = detect("https://rally.example/slm/US1234", DEFAULT_PROVIDERS)
    expect(m).toMatchObject({
      id: "US1234",
      provider: { id: "rally" },
    })
  })

  it("returns null for an unmatched URL", () => {
    expect(detect("https://example.com/x", DEFAULT_PROVIDERS)).toBeNull()
  })
})
