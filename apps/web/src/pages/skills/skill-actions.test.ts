import { describe, expect, it, vi } from "vitest"
import { ErrorCode } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { installSkill, uninstallSkill, updateSkill } from "./skill-actions"

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
    onRequest() {
      return () => {}
    },
    on() {
      return () => {}
    },
    close() {},
  }
}

describe("skill-actions", () => {
  it("installSkill returns conflict on FCP conflict", async () => {
    const client = fakeClient(() =>
      Promise.reject({ data: { code: "conflict" }, code: ErrorCode.conflict })
    )
    await expect(
      installSkill(client, {
        sourceId: "repo",
        slug: "write-tests",
        version: 1,
      })
    ).resolves.toBe("conflict")
  })

  it("uninstallSkill returns ok", async () => {
    const call = vi.fn().mockResolvedValue({})
    const client = fakeClient(call)
    await expect(uninstallSkill(client, "write-tests")).resolves.toBe("ok")
    expect(call).toHaveBeenCalledWith("skill/uninstall", {
      slug: "write-tests",
    })
  })

  it("updateSkill uninstalls then installs", async () => {
    const methods: string[] = []
    const client = fakeClient((method) => {
      methods.push(method)
      return Promise.resolve({})
    })
    await expect(
      updateSkill(client, {
        sourceId: "repo",
        slug: "write-tests",
        version: 2,
      })
    ).resolves.toBe("ok")
    expect(methods).toEqual(["skill/uninstall", "skill/install"])
  })
})
