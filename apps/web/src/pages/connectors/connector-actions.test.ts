import { describe, expect, it, vi } from "vitest"
import { ErrorCode } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import {
  removeConnector,
  saveConnector,
  setCapability,
  slugFromName,
} from "./connector-actions"

function fakeClient(
  impl: (method: string, params: unknown) => Promise<unknown>
): FlowsClient {
  return {
    ready: Promise.resolve({
      protocolVersion: 1,
      engineInfo: { name: "fake", version: "0" },
      engineCapabilities: { agents: [], nodeKinds: [] },
      workspace: { home: "/tmp", id: "ws" },
    }),
    call(method, params) {
      return impl(method, params) as Promise<never>
    },
    onNotification() {
      return () => {}
    },
    on() {
      return () => {}
    },
    close() {},
  }
}

const sample = {
  id: "wiki",
  name: "Wiki",
  transport: "api" as const,
  how: "https://wiki.example/api",
  auth: "cookies" as const,
  capabilities: [{ name: "read", desc: "Read", write: false, allowed: true }],
}

describe("connector-actions", () => {
  it("saveConnector returns conflict on FCP conflict", async () => {
    const client = fakeClient(() =>
      Promise.reject({ data: { code: "conflict" }, code: ErrorCode.conflict })
    )
    await expect(saveConnector(client, sample)).resolves.toEqual({
      ok: false,
      kind: "conflict",
    })
  })

  it("removeConnector returns ok", async () => {
    const call = vi.fn().mockResolvedValue({})
    const client = fakeClient(call)
    await expect(removeConnector(client, "wiki")).resolves.toEqual({ ok: true })
    expect(call).toHaveBeenCalledWith("connector/remove", { id: "wiki" })
  })

  it("setCapability returns hash on ok", async () => {
    const call = vi.fn().mockResolvedValue({ hash: "abc" })
    const client = fakeClient(call)
    await expect(
      setCapability(client, {
        id: "wiki",
        name: "read",
        allowed: false,
        baseHash: "old",
      })
    ).resolves.toEqual({ ok: true, hash: "abc" })
    expect(call).toHaveBeenCalledWith("connector/set_capability", {
      id: "wiki",
      name: "read",
      allowed: false,
      baseHash: "old",
    })
  })

  it("slugFromName lowercases and dashes", () => {
    expect(slugFromName("Open Search", "x")).toBe("open-search")
    expect(slugFromName("!!!", "fallback")).toBe("fallback")
  })
})
