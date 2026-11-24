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

/** Groups for the add-node menu (BL-202). */
export const KIND_GROUPS: { title: string; kinds: NodeKindName[] }[] = [
  { title: "Inputs", kinds: ["trigger", "asset", "prompt"] },
  { title: "Steps", kinds: ["agent", "command", "llm"] },
  { title: "Flow", kinds: ["judge", "approval", "output"] },
]

export type RunState = "running" | "done" | "failed" | "waiting" | "skipped"

export type CanvasNodeData = {
  kind: NodeKindName
  name?: string
  /** One-line body from YAML for the card. */
  summary?: string
  question?: string
  title?: string
  cli?: "claude" | "cursor"
  model?: string
  effort?: Effort
  connectors?: string[]
  skills?: string[]
  state?: RunState
  result?: string
}

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind as NodeKindName] ?? kind
}
