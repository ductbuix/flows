import type { Edge, Node } from "@xyflow/react"

export type NodeKind =
  | "trigger"
  | "asset"
  | "llm"
  | "condition"
  | "approval"
  | "notify"

export type RunState = "running" | "done" | "failed" | "waiting" | "skipped"

export type FlowData = {
  /** llm, condition */
  prompt?: string
  provider?: string
  model?: string
  effort?: string
  /** settings panel */
  systemPrompt?: string
  timeout?: string
  retries?: string
  format?: string
  ifUnsure?: string
  autoReject?: string
  channel?: string
  body?: string
  description?: string
  /** approval */
  question?: string
  /** output (notification) */
  title?: string
  /** asset: one output type. No inputs = a file from the Library; inputs = made by the flow. */
  assetKind?: "image" | "markdown"
  name?: string
  /** run state, filled by a (simulated) run */
  state?: RunState
  result?: string
}

export type FlowNode = Node<FlowData, NodeKind>
export type FlowEdge = Edge
export type Flow = { nodes: FlowNode[]; edges: FlowEdge[] }

export const PROVIDERS = [{ value: "cursor", label: "Cursor CLI" }]
export const MODELS = [
  { value: "haiku-5-5", label: "Claude Haiku 5.5" },
  { value: "sonnet-5-5", label: "Claude Sonnet 5.5" },
  { value: "opus-5-5", label: "Claude Opus 5.5" },
]
export const EFFORTS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

/** Files the user uploaded; a fixed asset picks one. */
export const KIND_LABEL: Record<NodeKind, string> = {
  trigger: "Trigger",
  asset: "Asset",
  llm: "LLM",
  condition: "Condition",
  approval: "Approval",
  notify: "Output",
}

export const KIND_GROUPS: { title: string; kinds: NodeKind[] }[] = [
  { title: "Inputs", kinds: ["trigger", "asset"] },
  { title: "Steps", kinds: ["llm"] },
  { title: "Flow", kinds: ["condition", "approval", "notify"] },
]

export function newData(kind: NodeKind): FlowData {
  switch (kind) {
    case "llm":
      return { prompt: "", provider: "cursor", model: "opus-5-5", effort: "high" }
    case "condition":
      return { prompt: "", provider: "cursor", model: "haiku-5-5", effort: "medium" }
    case "approval":
      return { question: "" }
    case "notify":
      return { title: "" }
    case "asset":
      return { assetKind: "image", name: "" }
    default:
      return {}
  }
}

function llm(id: string, x: number, y: number, prompt: string, model = "opus-5-5"): FlowNode {
  return {
    id, type: "llm", position: { x, y },
    data: { prompt, provider: "cursor", model, effort: model === "haiku-5-5" ? "medium" : "high" },
  }
}

const e = (source: string, target: string, port = "text", sourceHandle = port, label?: string): FlowEdge => ({
  id: `${source}-${sourceHandle}-${target}`, source, target, sourceHandle, targetHandle: port, label,
})

const trigger: FlowNode = { id: "t", type: "trigger", position: { x: 0, y: 0 }, data: {} }

const FIX_FLAKY: Flow = {
  nodes: [
    trigger,
    { id: "a1", type: "asset", position: { x: 0, y: 170 }, data: { assetKind: "image", name: "US1234 Login flake on CI/attachments/failure.png" } },
    { id: "a2", type: "asset", position: { x: 0, y: 500 }, data: { assetKind: "markdown", name: "US1234 Login flake on CI/acceptance.md" } },
    llm("plan", 460, 0, "Analyze the failing test and plan the fix. Respond with a detailed plan.", "haiku-5-5"),
    llm("fix", 960, 40, "Update source code following the plan"),
    llm("unit", 1460, -120, "Run unit tests"),
    llm("e2e", 1460, 220, "Run playwright tests"),
    llm("sum", 1960, 40, "Consolidate and summarize test results"),
    { id: "cond", type: "condition", position: { x: 2460, y: 60 }, data: { prompt: "Evaluate: did all tests pass? Count failed tests.", provider: "cursor", model: "haiku-5-5", effort: "medium" } },
    { id: "ok", type: "approval", position: { x: 2960, y: -100 }, data: { question: "Open a PR with this fix?" } },
    llm("pr", 3300, -140, "Create a new branch, commit and open a PR"),
    { id: "done", type: "notify", position: { x: 3800, y: -60 }, data: { title: "PR opened" } },
    { id: "rep", type: "asset", position: { x: 2460, y: 520 }, data: { assetKind: "markdown", name: "test-report.md" } },
    { id: "bad", type: "notify", position: { x: 2960, y: 320 }, data: { title: "Tests still failing" } },
  ],
  edges: [
    e("t", "plan"), e("a1", "plan", "image", "out"), e("a2", "plan", "text", "out"),
    e("plan", "fix"), e("fix", "unit"), e("fix", "e2e"),
    e("unit", "sum"), e("e2e", "sum"), e("sum", "cond"),
    e("cond", "ok", "text", "yes", "Yes"), e("cond", "bad", "text", "no", "No"),
    e("sum", "rep", "any", "text"), e("ok", "pr"), e("pr", "done"),
  ],
}

const WEEKLY: Flow = {
  nodes: [
    trigger,
    llm("l", 460, 0, "Summarise merged work for the period."),
    { id: "ok", type: "approval", position: { x: 960, y: 40 }, data: { question: "Publish this summary to Confluence?" } },
    { id: "o", type: "notify", position: { x: 1300, y: 40 }, data: { title: "Report published" } },
  ],
  edges: [e("t", "l"), e("l", "ok"), e("ok", "o")],
}

function simple(prompt: string): Flow {
  return {
    nodes: [
      trigger,
      llm("l", 460, 0, prompt),
      { id: "o", type: "notify", position: { x: 960, y: 40 }, data: { title: "Done" } },
    ],
    edges: [e("t", "l"), e("l", "o")],
  }
}

export function flowFor(workflowId: string): Flow {
  if (workflowId === "fix-flaky-test") return FIX_FLAKY
  if (workflowId === "weekly-report") return WEEKLY
  if (workflowId === "triage-inbox") return simple("Label each ticket and name an owner.")
  return simple("Turn the changelog into release notes.")
}
