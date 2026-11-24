import { describe, expect, it, expectTypeOf } from "vitest"
import { z } from "zod"
import {
  defineMethod,
  defineNotification,
  ErrorCode,
  fcpMethodTable,
  fcpNotificationTable,
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
  inboxAnswerMethod,
  inboxDismissMethod,
  inboxListMethod,
  inboxUpdateNotification,
  runCancelMethod,
  runDeleteMethod,
  runGetChangesMethod,
  runGetLogMethod,
  runRerunMethod,
  runRetryStepMethod,
  runStartMethod,
  workflowCreateMethod,
  workflowDeleteMethod,
  workflowGetMethod,
  workflowListMethod,
  workflowRenameMethod,
  workflowSaveLayoutMethod,
  workflowSaveMethod,
  workflowUpdateNotification,
  workflowValidateMethod,
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

  it("declares workflow write methods and update notification", () => {
    expect(fcpMethodTable["workflow/create"]).toBe(workflowCreateMethod)
    expect(fcpMethodTable["workflow/save"]).toBe(workflowSaveMethod)
    expect(fcpMethodTable["workflow/rename"]).toBe(workflowRenameMethod)
    expect(fcpMethodTable["workflow/delete"]).toBe(workflowDeleteMethod)
    expect(fcpMethodTable["workflow/save_layout"]).toBe(
      workflowSaveLayoutMethod
    )
    expect(fcpMethodTable["workflow/validate"]).toBe(workflowValidateMethod)
    expect(workflowCreateMethod.kind).toBe("command")
    expect(workflowSaveMethod.kind).toBe("command")
    expect(workflowValidateMethod.kind).toBe("query")
    expect(workflowUpdateNotification.name).toBe("workflow/update")
  })

  it("declares connector list/get as queries and save/remove/set_capability/check as commands", () => {
    expect(fcpMethodTable["connector/list"].kind).toBe("query")
    expect(fcpMethodTable["connector/get"].kind).toBe("query")
    expect(fcpMethodTable["connector/save"].kind).toBe("command")
    expect(fcpMethodTable["connector/remove"].kind).toBe("command")
    expect(fcpMethodTable["connector/set_capability"].kind).toBe("command")
    expect(fcpMethodTable["connector/check"].kind).toBe("command")
    expect(fcpNotificationTable["connector/update"].name).toBe(
      "connector/update"
    )
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

  it("declares run command methods", () => {
    expect(fcpMethodTable["run/start"]).toBe(runStartMethod)
    expect(fcpMethodTable["run/cancel"]).toBe(runCancelMethod)
    expect(fcpMethodTable["run/rerun"]).toBe(runRerunMethod)
    expect(fcpMethodTable["run/retry_step"]).toBe(runRetryStepMethod)
    expect(fcpMethodTable["run/delete"]).toBe(runDeleteMethod)
    expect(fcpMethodTable["run/get_log"]).toBe(runGetLogMethod)
    expect(fcpMethodTable["run/get_changes"]).toBe(runGetChangesMethod)
    expect(runStartMethod.kind).toBe("command")
    expect(runGetLogMethod.kind).toBe("query")
    expect(runStartMethod.result.parse({ runId: "r1" })).toEqual({
      runId: "r1",
    })
  })

  it("declares inbox list/answer/dismiss and update notification", () => {
    expect(fcpMethodTable["inbox/list"]).toBe(inboxListMethod)
    expect(fcpMethodTable["inbox/answer"]).toBe(inboxAnswerMethod)
    expect(fcpMethodTable["inbox/dismiss"]).toBe(inboxDismissMethod)
    expect(inboxListMethod.kind).toBe("query")
    expect(inboxAnswerMethod.kind).toBe("command")
    expect(inboxDismissMethod.kind).toBe("command")
    expect(inboxUpdateNotification.name).toBe("inbox/update")
    expect(
      inboxAnswerMethod.params.parse({
        itemId: "approval:r1:ask:1",
        optionId: "approved",
      })
    ).toEqual({ itemId: "approval:r1:ask:1", optionId: "approved" })
  })
})
