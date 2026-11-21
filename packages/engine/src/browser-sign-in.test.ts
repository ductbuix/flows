import { describe, expect, it } from "vitest"
import { BrowserSignInError, connectionSignInHost } from "./browser-sign-in.ts"

describe("browser sign-in helpers", () => {
  it("parses domain and url from connection scope", () => {
    expect(
      connectionSignInHost({
        id: "rally",
        connector: "fake",
        name: "Rally",
        scope: { domain: "rally1.rallydev.com" },
        signIn: "cookies",
        refresh: "never",
        policy: "read-only",
      })
    ).toBe("rally1.rallydev.com")

    expect(
      connectionSignInHost({
        id: "rally",
        connector: "fake",
        name: "Rally",
        scope: { url: "https://rally1.rallydev.com/login" },
        signIn: "cookies",
        refresh: "never",
        policy: "read-only",
      })
    ).toBe("rally1.rallydev.com")
  })

  it("rejects missing domain", () => {
    expect(() =>
      connectionSignInHost({
        id: "rally",
        connector: "fake",
        name: "Rally",
        scope: {},
        signIn: "cookies",
        refresh: "never",
        policy: "read-only",
      })
    ).toThrow(BrowserSignInError)
  })
})
