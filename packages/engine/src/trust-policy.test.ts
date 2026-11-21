import { describe, expect, it } from "vitest"
import { decideTrust, isAlwaysTrusted } from "./trust-policy.ts"

describe("decideTrust", () => {
  const home = "/Users/dbx/.flowapp"

  it("returns none when nothing is stored", () => {
    expect(decideTrust({ homeRealpath: home, settings: null })).toBe("none")
  })

  it("returns always when settings match the realpath", () => {
    expect(
      decideTrust({
        homeRealpath: home,
        settings: { homeRealpath: home, trustedAt: "2026-01-01T00:00:00Z" },
      })
    ).toBe("always")
    expect(
      isAlwaysTrusted(home, {
        homeRealpath: home,
        trustedAt: "2026-01-01T00:00:00Z",
      })
    ).toBe(true)
  })

  it("invalidates always-trust when the realpath changes", () => {
    expect(
      decideTrust({
        homeRealpath: "/tmp/other",
        settings: { homeRealpath: home, trustedAt: "2026-01-01T00:00:00Z" },
      })
    ).toBe("none")
  })

  it("returns once from the run grant even without settings", () => {
    expect(
      decideTrust({
        homeRealpath: home,
        settings: null,
        runGrant: "once",
      })
    ).toBe("once")
  })
})
