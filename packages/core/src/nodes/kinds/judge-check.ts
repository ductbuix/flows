import { evaluateCheck, judgeCheckSchema } from "@workspace/contracts"
import { z } from "zod"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent } from "../types.ts"

const settings = z.object({
  mode: z.literal("check"),
  check: judgeCheckSchema,
})

type Settings = z.infer<typeof settings>

/**
 * Judge check mode (DES-032 / BL-101): test a named answer with no model
 * call. The verdict is the step result; inputs pass by reference
 * (DES-034). Registered as `judge`; rule mode routes to `condition`.
 */
export const judgeCheckKind = defineNodeKind({
  kind: "judge",
  settings,
  ports: { in: ["text", "file"], out: ["text", "file"] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    const { check } = ctx.settings
    const value = ctx.answers[check.field]
    const passed = evaluateCheck(check, value)
    const test = `${check.field} ${check.operator}${
      check.value === undefined ? "" : ` ${String(check.value)}`
    }`
    const title = `Check ${passed ? "passed" : "failed"}: ${test}`
    const text = `${check.field} = ${
      value === undefined ? "(not set)" : JSON.stringify(value)
    }\nbranch: ${passed ? "yes" : "no"}`
    ctx.log({
      kind: "message",
      title,
      status: passed ? "ok" : "failed",
      text,
    })
    yield {
      kind: "output_written",
      path: await ctx.outputs.write("text.md", `${title}\n\n${text}\n`),
    }
    yield { kind: "done", branch: passed ? "yes" : "no" }
  },
})
