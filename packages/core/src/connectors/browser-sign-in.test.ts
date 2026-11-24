import { describe, expect, it, vi } from "vitest"
import { createFcpConnection } from "../rpc/initialize.ts"
import {
  filterCookiesForDomains,
  performBrowserSignIn,
} from "./browser-sign-in.ts"

describe("filterCookiesForDomains", () => {
  it("keeps only cookies whose domain matches the allowlist", () => {
    const filtered = filterCookiesForDomains(
      [
        { name: "a", value: "1", domain: ".rally.example", path: "/" },
        { name: "b", value: "2", domain: "other.example", path: "/" },
        { name: "c", value: "3", path: "/" },
      ],
      ["rally.example"]
    )
    expect(filtered.map((c) => c.name)).toEqual(["a"])
  })
})

describe("performBrowserSignIn", () => {
  it("requests host/browser_sign_in when the client declared the capability", async () => {
    const peer = {
      request: vi.fn().mockResolvedValue({
        cookies: [
          { name: "s", value: "1", domain: "rally.example", path: "/" },
        ],
      }),
    }
    const connection = createFcpConnection()
    connection.initialized = true
    connection.clientCapabilities = { host: { browserSignIn: true } }

    const outcome = await performBrowserSignIn(
      { peer, connection },
      {
        connectorId: "rally",
        url: "https://rally.example/",
        cookieDomains: ["rally.example"],
      }
    )

    expect(peer.request).toHaveBeenCalledWith("host/browser_sign_in", {
      connectorId: "rally",
      url: "https://rally.example/",
      cookieDomains: ["rally.example"],
    })
    expect(outcome).toEqual({
      cookies: [{ name: "s", value: "1", domain: "rally.example", path: "/" }],
    })
  })

  it("returns cancelled from the host", async () => {
    const peer = {
      request: vi.fn().mockResolvedValue({ cancelled: true }),
    }
    const connection = createFcpConnection()
    connection.clientCapabilities = { host: { browserSignIn: true } }

    const outcome = await performBrowserSignIn(
      { peer, connection },
      {
        connectorId: "rally",
        url: "https://rally.example/",
        cookieDomains: ["rally.example"],
      }
    )
    expect(outcome).toEqual({ cancelled: true })
  })

  it("falls back to Chrome sign-in without the capability", async () => {
    const chromeSignIn = vi.fn().mockResolvedValue({
      cookies: [
        { name: "s", value: "chrome", domain: "rally.example", path: "/" },
      ],
    })
    const connection = createFcpConnection()
    connection.clientCapabilities = {}

    const outcome = await performBrowserSignIn(
      { connection, chromeSignIn },
      {
        connectorId: "rally",
        url: "https://rally.example/",
        cookieDomains: ["rally.example"],
      }
    )

    expect(chromeSignIn).toHaveBeenCalled()
    expect(outcome).toMatchObject({
      cookies: [{ name: "s", value: "chrome" }],
    })
  })

  it("throws unsupported when neither host nor Chrome is available", async () => {
    const connection = createFcpConnection()
    await expect(
      performBrowserSignIn(
        { connection },
        {
          connectorId: "rally",
          url: "https://rally.example/",
          cookieDomains: ["rally.example"],
        }
      )
    ).rejects.toMatchObject({ code: "unsupported" })
  })
})
