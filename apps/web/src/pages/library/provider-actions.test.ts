import { describe, expect, it, vi } from "vitest"
import { ErrorCode, type ProviderDescriptor } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { saveProvider, upsertProvider } from "./provider-actions"

const sample: ProviderDescriptor = {
  id: "jenkins",
  label: "Jenkins",
  icon: "ci",
  pattern: "jenkins[^/]*/job/(?<id>[^/]+)",
  example: "https://jenkins.example/job/auth-ci/4412",
  layout: ["build.json"],
  tags: ["jenkins:{id}"],
  access: "read",
  fetch: "Jenkins JSON API",
  custom: true,
}

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

describe("provider-actions", () => {
  it("saveProvider returns conflict on FCP conflict", async () => {
    const client = fakeClient(() =>
      Promise.reject({ data: { code: "conflict" }, code: ErrorCode.conflict })
    )
    await expect(saveProvider(client, sample)).resolves.toBe("conflict")
  })

  it("saveProvider calls library/save_provider", async () => {
    const call = vi.fn().mockResolvedValue({})
    const client = fakeClient(call)
    await expect(saveProvider(client, sample)).resolves.toBe("ok")
    expect(call).toHaveBeenCalledWith("library/save_provider", {
      provider: sample,
    })
  })

  it("upsertProvider replaces by id and sorts", () => {
    const a: ProviderDescriptor = { ...sample, id: "github", label: "GitHub" }
    const b: ProviderDescriptor = { ...sample, id: "rally", label: "Rally" }
    const updated: ProviderDescriptor = {
      ...sample,
      id: "github",
      label: "GitHub Cloud",
    }
    expect(upsertProvider([b, a], updated).map((p) => p.label)).toEqual([
      "GitHub Cloud",
      "Rally",
    ])
  })
})
