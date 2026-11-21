import { describe, expect, it } from "vitest"
import {
  connectionEnvName,
  connectionSchema,
  taskUsesEntrySchema,
} from "./connection.ts"

describe("connectionSchema", () => {
  const valid = {
    id: "github-acme",
    connector: "fake",
    name: "Acme GitHub",
    scope: { owner: "acme", repo: "api" },
    signIn: "cli" as const,
    refresh: "1h" as const,
  }

  it("parses a connection.yaml and defaults policy to read-only", () => {
    const conn = connectionSchema.parse(valid)
    expect(conn.policy).toBe("read-only")
    expect(conn.scope).toEqual({ owner: "acme", repo: "api" })
  })

  it("rejects secret keys token, password and cookie", () => {
    for (const key of ["token", "password", "cookie"] as const) {
      const result = connectionSchema.safeParse({ ...valid, [key]: "secret" })
      expect(result.success).toBe(false)
    }
  })

  it("rejects an invalid id", () => {
    expect(
      connectionSchema.safeParse({ ...valid, id: "GitHub_Acme" }).success
    ).toBe(false)
  })
})

describe("connectionEnvName", () => {
  it("maps a slug to RESOURCE_ upper snake case", () => {
    expect(connectionEnvName("rally-payments")).toBe("RESOURCE_RALLY_PAYMENTS")
    expect(connectionEnvName("github")).toBe("RESOURCE_GITHUB")
  })
})

describe("taskUsesEntrySchema", () => {
  it("accepts read and propose access", () => {
    expect(
      taskUsesEntrySchema.parse({
        connection: "github-acme",
        access: "read",
      })
    ).toEqual({ connection: "github-acme", access: "read" })
    expect(
      taskUsesEntrySchema.parse({
        connection: "github-acme",
        access: "propose",
      }).access
    ).toBe("propose")
  })
})
