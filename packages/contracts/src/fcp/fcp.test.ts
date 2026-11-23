import { describe, expect, it, expectTypeOf } from "vitest"
import { z } from "zod"
import {
  defineMethod,
  defineNotification,
  ErrorCode,
  fcpMethodTable,
  type FcpMethodParams,
  type FcpMethodResult,
  type FcpNotificationParams,
  jsonRpcCodeFor,
  workflowGetMethod,
  workflowListMethod,
} from "./index.ts"

describe("FCP helpers", () => {
  it("infers method param and result types", () => {
    const sampleMethod = defineMethod({
      name: "workflow/get",
      params: z.object({ id: z.string() }),
      result: z.object({ name: z.string() }),
      kind: "query",
    })
    expect(sampleMethod.kind).toBe("query")
    expect(sampleMethod.params.parse({ id: "w1" })).toEqual({ id: "w1" })
    expectTypeOf<FcpMethodParams<typeof sampleMethod>>().toEqualTypeOf<{
      id: string
    }>()
    expectTypeOf<FcpMethodResult<typeof sampleMethod>>().toEqualTypeOf<{
      name: string
    }>()
  })

  it("infers notification param types", () => {
    const sampleNotification = defineNotification({
      name: "run/update",
      params: z.object({ seq: z.number(), kind: z.literal("run_changed") }),
    })
    expect(sampleNotification.name).toBe("run/update")
    expectTypeOf<
      FcpNotificationParams<typeof sampleNotification>
    >().toEqualTypeOf<{
      seq: number
      kind: "run_changed"
    }>()
  })

  it("maps stable error codes to unique JSON-RPC numbers", () => {
    const numbers = Object.values(ErrorCode)
    expect(new Set(numbers).size).toBe(numbers.length)
    expect(jsonRpcCodeFor("invalid_params")).toBe(-32602)
    expect(jsonRpcCodeFor("internal")).toBe(-32603)
  })

  it("declares workflow/list and workflow/get as queries", () => {
    expect(fcpMethodTable["workflow/list"]).toBe(workflowListMethod)
    expect(fcpMethodTable["workflow/get"]).toBe(workflowGetMethod)
    expect(workflowListMethod.kind).toBe("query")
    expect(workflowGetMethod.kind).toBe("query")
    expect(workflowListMethod.params.parse({})).toEqual({})
    expect(workflowGetMethod.params.parse({ id: "demo" })).toEqual({
      id: "demo",
    })
  })
})
