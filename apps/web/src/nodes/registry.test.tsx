import { cleanup, render, screen } from "@testing-library/react"
import { ReactFlowProvider } from "@xyflow/react"
import { afterEach, describe, expect, it } from "vitest"
import { NODE_KINDS } from "@workspace/shared"
import { BotIcon } from "lucide-react"
import { NodeFrame } from "./NodeFrame"
import { NODE_VIEWS, isStepKind, nodeTextPath, viewOf } from "./index"

afterEach(cleanup)

describe("node views", () => {
  it("has one view per shared kind and no other", () => {
    expect(NODE_VIEWS.map((v) => v.kind).sort()).toEqual(
      NODE_KINDS.map((k) => k.kind).sort()
    )
    expect(viewOf("nope")).toBeUndefined()
  })

  it("finds the text file of a kind and the card width", () => {
    expect(nodeTextPath({ id: "a", kind: "agent" })).toBe("nodes/a/prompt.md")
    expect(nodeTextPath({ id: "p", kind: "prompt" })).toBe("nodes/p/text.md")
    expect(nodeTextPath({ id: "c", kind: "command" })).toBeNull()
    expect(isStepKind("agent")).toBe(true)
    expect(isStepKind("trigger")).toBe(false)
  })
})

describe("NodeFrame", () => {
  const frame = (props: Partial<Parameters<typeof NodeFrame>[0]>) =>
    render(
      <ReactFlowProvider>
        <NodeFrame id="n" name="Plan" icon={BotIcon} wide {...props} />
      </ReactFlowProvider>
    )

  it("sizes steps w-72 and others w-60", () => {
    frame({})
    expect(screen.getByTestId("node-n").className).toContain("w-72")
    cleanup()
    frame({ wide: false })
    expect(screen.getByTestId("node-n").className).toContain("w-60")
  })

  it("shows Run step, status, timer, result and Retry when given", () => {
    let ran = 0
    let retried = 0
    frame({
      status: "failed",
      timer: "0:12",
      result: "boom",
      onRun: () => ran++,
      onRetry: () => retried++,
    })
    expect(screen.getByTestId("node-status-n").textContent).toBe("Failed")
    expect(screen.getByText("0:12")).toBeTruthy()
    expect(screen.getByTestId("node-result-n").textContent).toBe("boom")
    screen.getByRole("button", { name: "Run step" }).click()
    screen.getByRole("button", { name: "Retry" }).click()
    expect([ran, retried]).toEqual([1, 1])
  })

  it("hides run state slots by default", () => {
    frame({})
    expect(screen.queryByRole("button", { name: "Run step" })).toBeNull()
    expect(screen.queryByTestId("node-status-n")).toBeNull()
  })
})
