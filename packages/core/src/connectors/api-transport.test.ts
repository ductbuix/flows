import { describe, expect, it } from "vitest"
import { isEngineError } from "../rpc/map-error.ts"
import { createFakeClock } from "../testing/index.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import { cookiesSecretKey, tokenSecretKey } from "./api-auth.ts"
import { cookieJar, jenkins, rally, stack } from "./api-transport-test-utils.ts"
import { checkConnector } from "./check.ts"

describe("ConnectorRuntime + api transport", () => {
  it("sends cookies from SecretStore on call", async () => {
    let seenCookie: string | null = null
    const fetchFn: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers)
      seenCookie = headers.get("Cookie")
      expect(String(input)).toBe("https://rally.example/slm/artifact/US42")
      return new Response('{"ok":true}', { status: 200 })
    }
    const { runtime, secrets } = stack(rally, fetchFn)
    secrets.set(cookiesSecretKey("rally"), JSON.stringify(cookieJar("sess-1")))

    const result = await runtime.call(
      "rally",
      "artifact read",
      ["US42"],
      new AbortController().signal
    )
    expect(result.exitCode).toBe(0)
    expect(seenCookie).toBe("ZSESSIONID=sess-1")
    expect(result.stdout).toContain('"ok":true')
  })

  it("sends Bearer token from SecretStore for pat auth", async () => {
    let seenAuth: string | null = null
    const fetchFn: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers)
      seenAuth = headers.get("Authorization")
      return new Response("ok", { status: 200 })
    }
    const { runtime, secrets } = stack(jenkins, fetchFn)
    secrets.set(tokenSecretKey("jenkins"), "tok-abc")

    const result = await runtime.call(
      "jenkins",
      "job read",
      ["main"],
      new AbortController().signal
    )
    expect(result.exitCode).toBe(0)
    expect(seenAuth).toBe("Bearer tok-abc")
  })

  it("marks the connector expired on 401 via onUnauthorized and check", async () => {
    const unauthorized: { id: string; detail: string }[] = []
    const fetchFn: typeof fetch = async () =>
      new Response("nope", { status: 401 })
    const { runtime, secrets, connectors } = stack(
      rally,
      fetchFn,
      (c, detail) => {
        unauthorized.push({ id: c.id, detail })
      }
    )
    secrets.set(cookiesSecretKey("rally"), JSON.stringify(cookieJar()))

    const call = await runtime.call(
      "rally",
      "artifact read",
      [],
      new AbortController().signal
    )
    expect(call.exitCode).toBe(401)
    expect(unauthorized).toEqual([{ id: "rally", detail: "sign-in expired" }])

    const bus = new UpdateBus()
    const clock = createFakeClock(Date.parse("2026-11-24T12:00:00.000Z"))
    const outcome = await checkConnector(
      { service: connectors, runtime, bus, clock },
      "rally",
      new AbortController().signal
    )
    expect(outcome).toEqual({
      status: "expired",
      detail: "sign-in expired",
    })
    expect(connectors.getStatus("rally")?.status).toBe("expired")
  })

  it("refuses call when SecretStore has no credentials", async () => {
    const fetchFn: typeof fetch = async () => {
      throw new Error("fetch should not run")
    }
    const { runtime } = stack(rally, fetchFn)
    try {
      await runtime.call(
        "rally",
        "artifact read",
        [],
        new AbortController().signal
      )
      expect.unreachable("expected failed_precondition")
    } catch (err) {
      expect(isEngineError(err)).toBe(true)
      if (isEngineError(err)) expect(err.code).toBe("failed_precondition")
    }
  })
})
