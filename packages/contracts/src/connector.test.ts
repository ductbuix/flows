import { describe, expect, it } from "vitest"
import {
  AUTH_FOR,
  capabilitySchema,
  connectorSchema,
  parseConnectorYaml,
  safeParseConnectorYaml,
} from "./connector.ts"

describe("AUTH_FOR", () => {
  it("matches the Connectors mockup pairs", () => {
    expect(AUTH_FOR).toEqual({
      mcp: ["oauth", "pat", "none"],
      api: ["cookies", "pat", "oauth"],
      cli: ["cli-login", "pat"],
    })
  })
})

describe("capabilitySchema", () => {
  it("defaults write off and allows reads by default", () => {
    expect(capabilitySchema.parse({ name: "repo clone" })).toEqual({
      name: "repo clone",
      desc: "",
      write: false,
      allowed: true,
    })
  })

  it("defaults write capabilities to allowed: false", () => {
    expect(
      capabilitySchema.parse({
        name: "pr merge",
        desc: "Merge a PR",
        write: true,
      })
    ).toEqual({
      name: "pr merge",
      desc: "Merge a PR",
      write: true,
      allowed: false,
    })
  })

  it("keeps an explicit allowed on a write capability", () => {
    expect(
      capabilitySchema.parse({
        name: "pr create",
        write: true,
        allowed: true,
      }).allowed
    ).toBe(true)
  })
})

describe("connectorSchema", () => {
  const valid = {
    id: "github-cli",
    name: "GitHub",
    transport: "cli" as const,
    how: "gh",
    auth: "cli-login" as const,
    capabilities: [
      { name: "repo clone", desc: "Read repositories" },
      { name: "pr merge", desc: "Merge", write: true },
    ],
  }

  it("parses a connector file and defaults write caps off", () => {
    const c = connectorSchema.parse(valid)
    expect(c.capabilities[0]?.allowed).toBe(true)
    expect(c.capabilities[1]).toEqual({
      name: "pr merge",
      desc: "Merge",
      write: true,
      allowed: false,
    })
  })

  it("accepts every AUTH_FOR pair", () => {
    for (const [transport, auths] of Object.entries(AUTH_FOR)) {
      for (const auth of auths) {
        const result = connectorSchema.safeParse({
          id: "x",
          name: "X",
          transport,
          how: "how",
          auth,
        })
        expect(result.success).toBe(true)
      }
    }
  })

  it("rejects transport and auth pairs outside AUTH_FOR", () => {
    expect(
      connectorSchema.safeParse({
        ...valid,
        transport: "cli",
        auth: "cookies",
      }).success
    ).toBe(false)
    expect(
      connectorSchema.safeParse({
        ...valid,
        transport: "mcp",
        auth: "cli-login",
      }).success
    ).toBe(false)
    expect(
      connectorSchema.safeParse({
        ...valid,
        transport: "api",
        auth: "none",
      }).success
    ).toBe(false)
  })

  it("rejects secret keys token, password and cookie", () => {
    for (const key of ["token", "password", "cookie"] as const) {
      const result = connectorSchema.safeParse({ ...valid, [key]: "secret" })
      expect(result.success).toBe(false)
    }
  })

  it("rejects an invalid id", () => {
    expect(
      connectorSchema.safeParse({ ...valid, id: "GitHub_CLI" }).success
    ).toBe(false)
  })
})

describe("parseConnectorYaml", () => {
  it("parses YAML and rejects a secret field in the file", () => {
    const ok = parseConnectorYaml(`
id: rally
name: Rally
transport: api
how: https://rally.example/api
auth: cookies
capabilities:
  - name: artifact read
`)
    expect(ok.id).toBe("rally")
    expect(ok.capabilities[0]?.allowed).toBe(true)

    const bad = safeParseConnectorYaml(`
id: rally
name: Rally
transport: api
how: https://rally.example/api
auth: cookies
token: s3cret
`)
    expect(bad.success).toBe(false)
  })
})
