import { describe, expect, it, vi } from "vitest"
import type { Cookie, Session } from "electron"
import {
  filterSessionCookies,
  openBrowserSignIn,
  setBrowserSignInHost,
  signInPartition,
  type BrowserSignInHost,
} from "./host-browser-sign-in.ts"

function fakeCookie(
  partial: Pick<Cookie, "name" | "value" | "domain"> & Partial<Cookie>
): Cookie {
  return {
    path: "/",
    secure: false,
    httpOnly: false,
    session: true,
    hostOnly: true,
    sameSite: "unspecified",
    ...partial,
  }
}

describe("signInPartition", () => {
  it("uses a persist partition per connector", () => {
    expect(signInPartition("rally")).toBe("persist:flows-signin-rally")
  })
})

describe("filterSessionCookies", () => {
  it("returns only cookies for listed domains", () => {
    const filtered = filterSessionCookies(
      [
        fakeCookie({
          name: "ok",
          value: "1",
          domain: ".rally.example",
          secure: true,
          httpOnly: true,
          session: false,
          hostOnly: false,
        }),
        fakeCookie({
          name: "no",
          value: "2",
          domain: "other.example",
        }),
      ],
      ["rally.example"]
    )
    expect(filtered.map((c) => c.name)).toEqual(["ok"])
  })
})

describe("openBrowserSignIn", () => {
  it("returns filtered cookies when the window closes", async () => {
    const cookiesGet = vi.fn().mockResolvedValue([
      fakeCookie({
        name: "s",
        value: "1",
        domain: "rally.example",
        secure: true,
        session: false,
      }),
      fakeCookie({
        name: "x",
        value: "2",
        domain: "evil.example",
      }),
    ])
    let resolveClosed: (() => void) | undefined
    const host: BrowserSignInHost = {
      fromPartition: () =>
        ({ cookies: { get: cookiesGet } }) as unknown as Session,
      openWindow: async () => ({
        closed: new Promise<void>((r) => {
          resolveClosed = r
        }),
        close: () => resolveClosed?.(),
      }),
    }
    setBrowserSignInHost(host)

    const pending = openBrowserSignIn({
      connectorId: "rally",
      url: "https://rally.example/",
      cookieDomains: ["rally.example"],
    })
    resolveClosed?.()
    const result = await pending
    expect(result).toEqual({
      cookies: [
        {
          name: "s",
          value: "1",
          domain: "rally.example",
          path: "/",
          expires: undefined,
          httpOnly: false,
          secure: true,
          sameSite: undefined,
        },
      ],
    })
  })

  it("returns cancelled when aborted", async () => {
    const ac = new AbortController()
    let resolveClosed: (() => void) | undefined
    const host: BrowserSignInHost = {
      fromPartition: () =>
        ({ cookies: { get: vi.fn() } }) as unknown as Session,
      openWindow: async () => ({
        closed: new Promise<void>((r) => {
          resolveClosed = r
        }),
        close: () => resolveClosed?.(),
      }),
    }
    setBrowserSignInHost(host)

    const pending = openBrowserSignIn(
      {
        connectorId: "rally",
        url: "https://rally.example/",
        cookieDomains: ["rally.example"],
      },
      ac.signal
    )
    ac.abort()
    expect(await pending).toEqual({ cancelled: true })
  })
})
