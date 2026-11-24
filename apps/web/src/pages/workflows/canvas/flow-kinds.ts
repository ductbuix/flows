import type { Effort, NodeKindName } from "@workspace/contracts"

export type { NodeKindName }
import {
  Bell,
  Bot,
  FileText,
  GitFork,
  HandHelping,
  Terminal,
  Zap,
} from "lucide-react"

/** Display label per registry kind. */
export const KIND_LABEL: Record<NodeKindName, string> = {
  trigger: "Trigger",
  prompt: "Prompt",
  asset: "Asset",
  agent: "Agent",
  command: "Command",
  llm: "LLM",
  judge: "Judge",
  approval: "Approval",
  output: "Output",
}

export const KIND_ICON: Record<NodeKindName, typeof Zap> = {
  trigger: Zap,
  prompt: FileText,
  asset: FileText,
  agent: Bot,
  command: Terminal,
  llm: Bot,
  judge: GitFork,
  approval: HandHelping,
  output: Bell,
}

/** Groups for the add-node menu (BL-202). Agent is retired: use LLM. */
export const KIND_GROUPS: { title: string; kinds: NodeKindName[] }[] = [
  { title: "Inputs", kinds: ["trigger", "prompt", "asset"] },
  { title: "Steps", kinds: ["llm", "command"] },
  { title: "Flow", kinds: ["judge", "approval", "output"] },
]

/** Kinds with a settings panel; the rest edit everything on the card. */
export const HAS_SETTINGS: ReadonlySet<NodeKindName> = new Set([
  "llm",
  "agent",
  "command",
  "judge",
])

export type RunState = "running" | "done" | "failed" | "waiting" | "skipped"

export type CanvasNodeData = {
  kind: NodeKindName
  name?: string
  /** One-line body from YAML for the card. */
  summary?: string
  question?: string
  title?: string
  /** Command: the shell line. */
  run?: string
  /** Judge: rule (model) or check (answer test). */
  mode?: "rule" | "check"
  /** Output: where it goes; the canvas offers notify only. */
  target?: "notify" | "folder" | "publish"
  channel?: "app" | "system"
  /** Asset: library item ids. */
  items?: string[]
  cli?: "claude" | "cursor"
  model?: string
  effort?: Effort
  connectors?: string[]
  skills?: string[]
  state?: RunState
  result?: string
  failReason?: string
  /** Latest attempt number in the followed run. */
  attempt?: number
}

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind as NodeKindName] ?? kind
}
