import { describe, expect, it } from "vitest"
import { createFakeClock } from "../testing/fake-clock.ts"
import {
  createQuestionAskGate,
  parseAskQuestionParams,
  validateAskAnswers,
} from "./question-ask.ts"

const questions = [
  {
    id: "q1",
    prompt: "Mode?",
    options: [
      { id: "agent", label: "Agent" },
      { id: "plan", label: "Plan" },
    ],
  },
  {
    id: "q2",
    prompt: "Tags?",
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    allowMultiple: true,
  },
]

describe("validateAskAnswers", () => {
  it("honours multi-select and rejects extras on single-select", () => {
    expect(
      validateAskAnswers(questions, [
        { questionId: "q1", selectedOptionIds: ["agent"] },
        { questionId: "q2", selectedOptionIds: ["a", "b"] },
      ])
    ).toBe(true)
    expect(
      validateAskAnswers(questions, [
        { questionId: "q1", selectedOptionIds: ["agent", "plan"] },
        { questionId: "q2", selectedOptionIds: ["a"] },
      ])
    ).toBe(false)
  })
})

describe("QuestionAskGate", () => {
  it("parks then resolves answered with multi-select", async () => {
    const clock = createFakeClock(Date.parse("2026-11-24T00:00:00.000Z"))
    const asked: unknown[] = []
    const gate = createQuestionAskGate({
      clock,
      onRequested: (event) => {
        asked.push(event)
      },
    })
    const pending = gate.ask({
      runId: "r1",
      nodeId: "llm",
      pass: 1,
      requestId: "call_1",
      title: "Need input",
      questions,
    })
    await Promise.resolve()
    expect(asked).toHaveLength(1)
    expect(
      gate.answer("question:r1:llm:1:call_1", "answered", [
        { questionId: "q1", selectedOptionIds: ["plan"] },
        { questionId: "q2", selectedOptionIds: ["a", "b"] },
      ])
    ).toBe(true)
    await expect(pending).resolves.toEqual({
      outcome: "answered",
      answers: [
        { questionId: "q1", selectedOptionIds: ["plan"] },
        { questionId: "q2", selectedOptionIds: ["a", "b"] },
      ],
    })
  })

  it("rejects invalid multi-select on answer", async () => {
    const gate = createQuestionAskGate({
      clock: createFakeClock(0),
      onRequested: () => {},
    })
    const pending = gate.ask({
      runId: "r1",
      nodeId: "n",
      pass: 1,
      requestId: "1",
      questions: [questions[0]!],
    })
    await Promise.resolve()
    expect(
      gate.answer("question:r1:n:1:1", "answered", [
        { questionId: "q1", selectedOptionIds: ["agent", "plan"] },
      ])
    ).toBe(false)
    expect(gate.answer("question:r1:n:1:1", "skipped")).toBe(true)
    await expect(pending).resolves.toEqual({ outcome: "skipped" })
  })
})

describe("parseAskQuestionParams", () => {
  it("reads toolCallId, title and questions", () => {
    expect(
      parseAskQuestionParams({
        toolCallId: "call_123",
        title: "Need input",
        questions: [
          {
            id: "q1",
            prompt: "Which mode?",
            options: [{ id: "agent", label: "Agent" }],
            allowMultiple: false,
          },
        ],
      })
    ).toEqual({
      requestId: "call_123",
      title: "Need input",
      questions: [
        {
          id: "q1",
          prompt: "Which mode?",
          options: [{ id: "agent", label: "Agent" }],
          allowMultiple: false,
        },
      ],
    })
  })
})
