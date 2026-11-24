import { describe, expect, it, vi } from "vitest"
import type { FlowsClient } from "@workspace/sdk"
import {
  createWorkflow,
  deleteWorkflow,
  saveWorkflowLayout,
  saveWorkflowYaml,
  slugify,
  uniqueWorkflowId,
  updateWorkflowMeta,
} from "./workflow-actions"

function fakeClient(
  handlers: Record<string, (params: unknown) => unknown>
): FlowsClient {
  return {
    ready: Promise.resolve({
      protocolVersion: 1,
      engineInfo: { name: "fake", version: "0" },
      engineCapabilities: { agents: [], nodeKinds: [] },
      workspace: { home: "/tmp", id: "ws" },
    }),
    call(method, params) {
      const handler = handlers[method]
      if (!handler) return Promise.reject(new Error(`unexpected ${method}`))
      return Promise.resolve(handler(params)) as Promise<never>
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

describe("slugify / uniqueWorkflowId", () => {
  it("slugifies and avoids collisions", () => {
    expect(slugify("Fix Flaky Test!")).toBe("fix-flaky-test")
    expect(
      uniqueWorkflowId("Fix flaky test", [
        { id: "fix-flaky-test", taskCount: 1 },
      ])
    ).toBe("fix-flaky-test-2")
  })
})

describe("createWorkflow", () => {
  it("returns ok on success and conflict on clash", async () => {
    const ok = fakeClient({
      "workflow/create": () => ({ id: "a", taskCount: 1 }),
    })
    await expect(createWorkflow(ok, "a", "A", "goal")).resolves.toBe("ok")

    const clash = fakeClient({
      "workflow/create": () => {
        throw Object.assign(new Error("exists"), {
          data: { code: "conflict" },
        })
      },
    })
    await expect(createWorkflow(clash, "a", "A", "goal")).resolves.toBe(
      "conflict"
    )
  })
})

describe("updateWorkflowMeta", () => {
  it("gets, patches name/goal, and saves with baseHash", async () => {
    const save = vi.fn(() => ({
      id: "w",
      yaml: "id: w\n",
      hash: "h2",
      workflow: null,
      errors: [],
    }))
    const client = fakeClient({
      "workflow/get": () => ({
        id: "w",
        yaml: "id: w\ngoal: old\n",
        hash: "h1",
        workflow: null,
        errors: [],
      }),
      "workflow/save": save,
    })
    await expect(
      updateWorkflowMeta(client, "w", "New", "fresh goal")
    ).resolves.toBe("ok")
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "w",
        baseHash: "h1",
        yaml: expect.stringContaining("name: New"),
      })
    )
    expect(save.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        yaml: expect.stringContaining("goal: fresh goal"),
      })
    )
  })
})

describe("deleteWorkflow / saveWorkflowYaml", () => {
  it("deletes and saves; maps conflict on save", async () => {
    const ok = fakeClient({
      "workflow/delete": () => ({}),
      "workflow/save": () => ({
        id: "w",
        yaml: "id: w\n",
        hash: "h2",
        workflow: null,
        errors: [],
      }),
    })
    await expect(deleteWorkflow(ok, "w")).resolves.toBe("ok")
    await expect(saveWorkflowYaml(ok, "w", "id: w\n", "h")).resolves.toEqual({
      ok: true,
      hash: "h2",
    })

    const clash = fakeClient({
      "workflow/save": () => {
        throw Object.assign(new Error("stale"), { data: { code: "conflict" } })
      },
    })
    await expect(saveWorkflowYaml(clash, "w", "id: w\n", "h")).resolves.toBe(
      "conflict"
    )
  })

  it("saves layout via workflow/save_layout", async () => {
    const layout = { version: 1 as const, nodes: { start: { x: 1, y: 2 } } }
    const client = fakeClient({
      "workflow/save_layout": () => layout,
    })
    await expect(saveWorkflowLayout(client, "w", layout)).resolves.toEqual({
      ok: true,
      layout,
    })
  })
})
