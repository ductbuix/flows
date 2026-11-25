export type AskKind = "approval" | "permission" | "question"

export type Ask = {
  kind: AskKind
  nodeName: string
  subtitle: string
  question: string
  tool?: string
  options: { label: string; ok?: boolean }[]
}

/** One sample ask per kind, as the canvas node shows it. */
export const ASKS: Ask[] = [
  {
    kind: "approval",
    nodeName: "Publish release notes",
    subtitle: "Approval step waiting for you",
    question: "Publish the release notes to the team channel?",
    options: [{ label: "Approve", ok: true }, { label: "Reject" }],
  },
  {
    kind: "permission",
    nodeName: "Run the build",
    subtitle: "Agent step asking to run a command",
    question: "Allow the agent to run this command?",
    tool: "Shell: pnpm build",
    options: [
      { label: "Allow once", ok: true },
      { label: "Always allow" },
      { label: "Reject" },
    ],
  },
  {
    kind: "question",
    nodeName: "Pick a reviewer",
    subtitle: "Agent step with a question",
    question: "Which reviewer should own the change?",
    options: [],
  },
]
