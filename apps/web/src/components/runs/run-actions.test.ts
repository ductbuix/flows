import { describe, expect, it, vi } from "vitest"
import { ErrorCode } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { cancelRun, deleteRun, rerunRun, startRun } from "./run-actions"

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

describe("run-actions", () => {
  it("startRun returns runId", async () => {
    const call = vi.fn().mockResolvedValue({ runId: "r-1" })
    const client = fakeClient(call)
    await expect(startRun(client, { workflowId: "diamond" })).resolves.toEqual({
      ok: true,
      runId: "r-1",
    })
    expect(call).toHaveBeenCalledWith(
      "run/start",
      expect.objectContaining({ workflowId: "diamond" })
    )
  })

  it("startRun passes cardId for a card", async () => {
    const call = vi.fn().mockResolvedValue({ runId: "r-2" })
    const client = fakeClient(call)
    await expect(
      startRun(client, { workflowId: "diamond", cardId: "fix-login" })
    ).resolves.toEqual({ ok: true, runId: "r-2" })
    expect(call).toHaveBeenCalledWith(
      "run/start",
      expect.objectContaining({
        workflowId: "diamond",
        cardId: "fix-login",
      })
    )
  })

  it("cancelRun returns conflict on FCP conflict", async () => {
    const client = fakeClient(() =>
      Promise.reject({ data: { code: "conflict" }, code: ErrorCode.conflict })
    )
    await expect(cancelRun(client, "r-1")).resolves.toEqual({
      ok: false,
      kind: "conflict",
      message: "",
    })
  })

  it("rerunRun and deleteRun call FCP", async () => {
    const methods: string[] = []
    const client = fakeClient((method) => {
      methods.push(method)
      return Promise.resolve(method === "run/rerun" ? { runId: "r-2" } : {})
    })
    await expect(rerunRun(client, "r-1")).resolves.toEqual({
      ok: true,
      runId: "r-2",
    })
    await expect(deleteRun(client, "r-1")).resolves.toEqual({ ok: true })
    expect(methods).toEqual(["run/rerun", "run/delete"])
  })
})
