import { describe, expect, it } from "vitest"
import type { FlowsClient } from "@workspace/sdk"
import { listAllFilePaths } from "./list-files"

function fakeClient(
  pages: { items: { path: string; kind: "file" | "dir" }[]; next?: string }[]
): FlowsClient {
  let i = 0
  return {
    ready: Promise.resolve({
      protocolVersion: 1,
      engineInfo: { name: "fake", version: "0" },
      engineCapabilities: { agents: [], nodeKinds: [] },
      workspace: { home: "/tmp", id: "ws" },
    }),
    call(method) {
      if (method !== "file/list") {
        return Promise.reject(new Error(`unexpected ${method}`))
      }
      const page = pages[i++]
      if (!page) return Promise.reject(new Error("no more pages"))
      return Promise.resolve(page) as Promise<never>
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

describe("listAllFilePaths", () => {
  it("pages and keeps files only", async () => {
    const client = fakeClient([
      {
        items: [
          { path: "a", kind: "dir" },
          { path: "a/x.md", kind: "file" },
        ],
        next: "a/x.md",
      },
      {
        items: [{ path: "b/y.yaml", kind: "file" }],
      },
    ])
    await expect(listAllFilePaths(client)).resolves.toEqual([
      "a/x.md",
      "b/y.yaml",
    ])
  })
})
