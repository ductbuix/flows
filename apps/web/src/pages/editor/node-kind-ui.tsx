import {
  BotIcon,
  FolderOutputIcon,
  MessageSquareTextIcon,
  TerminalIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"
import { NODE_KINDS } from "@workspace/shared"

type Meta = { label: string; hint: string; icon: LucideIcon }

/** Words and icon per kind; which kinds exist comes from the registry. */
export const KIND_META: Record<string, Meta> = {
  trigger: { label: "Trigger", hint: "Starts a run", icon: ZapIcon },
  prompt: {
    label: "Prompt",
    hint: "A fixed piece of text",
    icon: MessageSquareTextIcon,
  },
  agent: { label: "Agent", hint: "An AI agent CLI", icon: BotIcon },
  command: { label: "Command", hint: "A shell command", icon: TerminalIcon },
  output: {
    label: "Output",
    hint: "Saves the result to a folder",
    icon: FolderOutputIcon,
  },
}

export const GROUP_LABEL = {
  inputs: "Inputs",
  steps: "Steps",
  flow: "Flow",
} as const

export const GROUP_ORDER = ["inputs", "steps", "flow"] as const

export function kindLabel(kind: string): string {
  return KIND_META[kind]?.label ?? kind
}

/** Registry kinds in one group, limited to `allowed` when given. */
export function kindsInGroup(
  group: (typeof GROUP_ORDER)[number],
  allowed?: readonly string[]
): string[] {
  return NODE_KINDS.filter(
    (k) => k.group === group && (!allowed || allowed.includes(k.kind))
  ).map((k) => k.kind)
}
