import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { FlowsClientProvider } from "./client-context.tsx"
import { createFakeClient } from "./fake-client.ts"
import { useQuery } from "./use-query.ts"
import { useSubscription } from "./use-subscription.ts"

afterEach(cleanup)

function wrapperFor(client: ReturnType<typeof createFakeClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <FlowsClientProvider client={client}>{children}</FlowsClientProvider>
  }
}

describe("useQuery", () => {
  it("returns data after the initial call", async () => {
    let n = 0
    const client = createFakeClient({
      call: async (method) => {
        if (method === "subscribe" || method === "unsubscribe") return {}
        n += 1
        return { id: "c1", n }
      },
    })

    const { result } = renderHook(
      () => useQuery("docket/get_card", { id: "c1" }, { topics: ["docket"] }),
      { wrapper: wrapperFor(client) }
    )

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ id: "c1", n: 1 })
    expect(result.current.error).toBeNull()
    expect(client.calls.some((c) => c.method === "subscribe")).toBe(true)
  })

  it("refetches on a matching update notification", async () => {
    let n = 0
    const client = createFakeClient({
      call: async (method) => {
        if (method === "subscribe" || method === "unsubscribe") return {}
        n += 1
        return { id: "c1", n }
      },
    })

    const { result } = renderHook(
      () => useQuery("docket/get_card", { id: "c1" }, { topics: ["docket"] }),
      { wrapper: wrapperFor(client) }
    )
    await waitFor(() => expect(result.current.data).toEqual({ id: "c1", n: 1 }))

    client.emitNotification("docket/update", {
      seq: 1,
      kind: "card_removed",
      cardId: "c1",
    })
    await waitFor(() => expect(result.current.data).toEqual({ id: "c1", n: 2 }))
  })

  it("refetches on resync for a listed topic", async () => {
    let n = 0
    const client = createFakeClient({
      call: async (method) => {
        if (method === "subscribe" || method === "unsubscribe") return {}
        n += 1
        return { id: "c1", n }
      },
    })

    const { result } = renderHook(
      () => useQuery("docket/get_card", { id: "c1" }, { topics: ["docket"] }),
      { wrapper: wrapperFor(client) }
    )
    await waitFor(() => expect(result.current.data).toEqual({ id: "c1", n: 1 }))

    client.emitResync("inbox")
    await vi.waitFor(() => expect(n).toBe(1))

    client.emitResync("docket")
    await waitFor(() => expect(result.current.data).toEqual({ id: "c1", n: 2 }))
  })

  it("surfaces call errors", async () => {
    const client = createFakeClient({
      call: async (method) => {
        if (method === "subscribe" || method === "unsubscribe") return {}
        throw new Error("boom")
      },
    })

    const { result } = renderHook(
      () => useQuery("docket/get_card", { id: "c1" }, { topics: ["docket"] }),
      { wrapper: wrapperFor(client) }
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toEqual(new Error("boom"))
  })
})

describe("useSubscription", () => {
  it("invokes the handler for matching updates", async () => {
    const client = createFakeClient({
      call: async (method) => {
        if (method === "subscribe" || method === "unsubscribe") return {}
        return {}
      },
    })
    const seen: unknown[] = []

    renderHook(
      () =>
        useSubscription("docket", (params) => {
          seen.push(params)
        }),
      { wrapper: wrapperFor(client) }
    )

    await waitFor(() =>
      expect(client.calls.some((c) => c.method === "subscribe")).toBe(true)
    )

    client.emitNotification("docket/update", {
      seq: 1,
      kind: "card_removed",
      cardId: "x",
    })
    await waitFor(() =>
      expect(seen).toEqual([{ seq: 1, kind: "card_removed", cardId: "x" }])
    )
  })
})
