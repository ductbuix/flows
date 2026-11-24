import { describe, expect, it, vi } from "vitest"
import { ErrorCode } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { answerInboxItem, dismissInboxItem } from "./inbox-actions"

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

describe("inbox-actions", () => {
  it("answerInboxItem returns ok", async () => {
    const call = vi.fn().mockResolvedValue({})
    const client = fakeClient(call)
    await expect(
      answerInboxItem(client, { itemId: "a1", optionId: "approved" })
    ).resolves.toBe("ok")
    expect(call).toHaveBeenCalledWith("inbox/answer", {
      itemId: "a1",
      optionId: "approved",
    })
  })

  it("answerInboxItem returns conflict when already answered", async () => {
    const client = fakeClient(() =>
      Promise.reject({
        data: { code: "not_found" },
        code: ErrorCode.not_found,
      })
    )
    await expect(
      answerInboxItem(client, { itemId: "a1", optionId: "approved" })
    ).resolves.toBe("conflict")
  })

  it("dismissInboxItem returns conflict on FCP conflict", async () => {
    const client = fakeClient(() =>
      Promise.reject({ data: { code: "conflict" }, code: ErrorCode.conflict })
    )
    await expect(dismissInboxItem(client, "a1")).resolves.toBe("conflict")
  })

  it("dismissInboxItem returns ok", async () => {
    const call = vi.fn().mockResolvedValue({})
    const client = fakeClient(call)
    await expect(dismissInboxItem(client, "a1")).resolves.toBe("ok")
    expect(call).toHaveBeenCalledWith("inbox/dismiss", { itemId: "a1" })
  })
})
