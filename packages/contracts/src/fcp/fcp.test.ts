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
  skillGetMethod,
  skillInstallMethod,
  skillListMethod,
  skillUninstallMethod,
  skillUpdateNotification,
  fileListMethod,
  fileReadTextMethod,
  fileRevealMethod,
  fileStatMethod,
  fileWriteTextMethod,
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

  it("declares connector list/get as queries and save/remove/set_capability as commands", () => {
    expect(fcpMethodTable["connector/list"].kind).toBe("query")
    expect(fcpMethodTable["connector/get"].kind).toBe("query")
    expect(fcpMethodTable["connector/save"].kind).toBe("command")
    expect(fcpMethodTable["connector/remove"].kind).toBe("command")
    expect(fcpMethodTable["connector/set_capability"].kind).toBe("command")
  })

  it("declares library/list_providers as a query and library/save_provider as a command", () => {
    expect(fcpMethodTable["library/list_providers"].kind).toBe("query")
    expect(fcpMethodTable["library/save_provider"].kind).toBe("command")
  })

  it("declares skill/list and skill/get as queries and install/uninstall as commands", () => {
    expect(fcpMethodTable["skill/list"]).toBe(skillListMethod)
    expect(fcpMethodTable["skill/get"]).toBe(skillGetMethod)
    expect(fcpMethodTable["skill/install"]).toBe(skillInstallMethod)
    expect(fcpMethodTable["skill/uninstall"]).toBe(skillUninstallMethod)
    expect(skillListMethod.kind).toBe("query")
    expect(skillGetMethod.kind).toBe("query")
    expect(skillInstallMethod.kind).toBe("command")
    expect(skillUninstallMethod.kind).toBe("command")
    expect(
      skillGetMethod.params.parse({ slug: "write-tests", scope: "workspace" })
    ).toEqual({ slug: "write-tests", scope: "workspace" })
    expect(skillUpdateNotification.name).toBe("skill/update")
  })

  it("declares file/* methods", () => {
    expect(fcpMethodTable["file/list"]).toBe(fileListMethod)
    expect(fcpMethodTable["file/stat"]).toBe(fileStatMethod)
    expect(fcpMethodTable["file/read_text"]).toBe(fileReadTextMethod)
    expect(fcpMethodTable["file/write_text"]).toBe(fileWriteTextMethod)
    expect(fcpMethodTable["file/reveal"]).toBe(fileRevealMethod)
    expect(fileListMethod.kind).toBe("query")
    expect(fileWriteTextMethod.kind).toBe("command")
    expect(fileRevealMethod.kind).toBe("command")
  })
})
