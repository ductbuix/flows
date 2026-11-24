import type { ConnectorFile } from "@workspace/contracts"
import { describe, expect, it } from "vitest"
import { isEngineError } from "../rpc/map-error.ts"
import { cookiesSecretKey, type StoredCookie } from "./api-auth.ts"
import { cookieJar, rally, stack } from "./api-transport-test-utils.ts"

describe("API transport credential pinning (BL-162)", () => {
  it("refuses an absolute path whose origin differs from how before fetch", async () => {
    let fetched = false
    const fetchFn: typeof fetch = async () => {
      fetched = true
      throw new Error("fetch should not run")
    }
    const open: ConnectorFile = {
      ...rally,
      capabilities: [
        {
          name: "open",
          desc: "Open",
          write: false,
          allowed: true,
          cmd: ["GET", "https://evil.example/steal"],
        },
      ],
    }
    const { runtime, secrets } = stack(open, fetchFn)
    secrets.set(cookiesSecretKey("rally"), JSON.stringify(cookieJar()))
    try {
      await runtime.call("rally", "open", [], new AbortController().signal)
      expect.unreachable("expected policy_denied")
    } catch (err) {
      expect(isEngineError(err)).toBe(true)
      if (isEngineError(err)) expect(err.code).toBe("policy_denied")
    }
    expect(fetched).toBe(false)
  })

  it("URL-encodes args so they cannot change the origin or path segments", async () => {
    let seenUrl: string | null = null
    const fetchFn: typeof fetch = async (input) => {
      seenUrl = String(input)
      return new Response("ok", { status: 200 })
    }
    const { runtime, secrets } = stack(rally, fetchFn)
    secrets.set(cookiesSecretKey("rally"), JSON.stringify(cookieJar()))
    await runtime.call(
      "rally",
      "artifact read",
      ["../", "https://evil.example"],
      new AbortController().signal
    )
    expect(seenUrl).toBe(
      "https://rally.example/slm/artifact/..%2F/https%3A%2F%2Fevil.example"
    )
  })

  it("does not follow redirects; 3xx is an error with redirect manual", async () => {
    let seenRedirect: RequestRedirect | undefined
    const fetchFn: typeof fetch = async (_input, init) => {
      seenRedirect = init?.redirect
      return new Response("", {
        status: 302,
        headers: { Location: "https://evil.example/steal" },
      })
    }
    const { runtime, secrets } = stack(rally, fetchFn)
    secrets.set(cookiesSecretKey("rally"), JSON.stringify(cookieJar()))
    const result = await runtime.call(
      "rally",
      "artifact read",
      [],
      new AbortController().signal
    )
    expect(seenRedirect).toBe("manual")
    expect(result.exitCode).toBe(302)
    expect(result.stderr).toBe("HTTP 302")
  })

  it("sends only cookies that match request host, path, and secure", async () => {
    let seenCookie: string | null = null
    const fetchFn: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers)
      seenCookie = headers.get("Cookie")
      return new Response("ok", { status: 200 })
    }
    const { runtime, secrets } = stack(rally, fetchFn)
    const jar: StoredCookie[] = [
      { name: "ok", value: "1", domain: "rally.example", path: "/slm" },
      { name: "sub", value: "1", domain: ".example", path: "/" },
      { name: "hostonly", value: "1", path: "/" },
      { name: "wrong-domain", value: "1", domain: "evil.example", path: "/" },
      {
        name: "wrong-path",
        value: "1",
        domain: "rally.example",
        path: "/admin",
      },
      {
        name: "secure-only",
        value: "1",
        domain: "rally.example",
        path: "/",
        secure: true,
      },
    ]
    secrets.set(cookiesSecretKey("rally"), JSON.stringify(jar))

    const result = await runtime.call(
      "rally",
      "artifact read",
      ["US42"],
      new AbortController().signal
    )
    expect(result.exitCode).toBe(0)
    expect(seenCookie).toBe("ok=1; sub=1; hostonly=1; secure-only=1")
    expect(seenCookie).not.toContain("wrong-domain")
    expect(seenCookie).not.toContain("wrong-path")
  })

  it("omits secure cookies on http how", async () => {
    let seenCookie: string | null = null
    const httpRally: ConnectorFile = {
      ...rally,
      how: "http://rally.example/slm",
    }
    const fetchFn: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers)
      seenCookie = headers.get("Cookie")
      return new Response("ok", { status: 200 })
    }
    const { runtime, secrets } = stack(httpRally, fetchFn)
    const jar: StoredCookie[] = [
      { name: "plain", value: "1", domain: "rally.example", path: "/" },
      {
        name: "secure-only",
        value: "1",
        domain: "rally.example",
        path: "/",
        secure: true,
      },
    ]
    secrets.set(cookiesSecretKey("rally"), JSON.stringify(jar))
    await runtime.call(
      "rally",
      "artifact read",
      [],
      new AbortController().signal
    )
    expect(seenCookie).toBe("plain=1")
  })
})
