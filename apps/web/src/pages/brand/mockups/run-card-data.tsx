import { FileText, Search, Tag } from "lucide-react"
import type { TaskStep } from "@workspace/ui/components/task"

export type Branch = {
  title: string
  duration: string
  status?: "running" | "error"
  steps: TaskStep[]
}

export const RUNNING: Branch[] = [
  {
    title: "Compare open PRs with the spec",
    duration: "3.0s",
    status: "running",
    steps: [
      { title: "Searching 4 repositories", icon: <Search /> },
      { title: "Reading 6 files", icon: <FileText />, status: "running" },
    ],
  },
  {
    title: "Check test coverage",
    duration: "2.7s",
    status: "running",
    steps: [
      { title: "Running the test suite", icon: <Search /> },
      { title: "Rate limited, retrying", status: "error" },
    ],
  },
  {
    title: "Draft release notes",
    duration: "2.4s",
    status: "running",
    steps: [
      { title: "Collecting 5 merged changes", icon: <Search /> },
      { title: "Grouping by label", icon: <Tag />, status: "running" },
    ],
  },
]

export const DONE: Branch[] = [
  {
    title: "Compare open PRs with the spec",
    duration: "4.7s",
    steps: [{ title: "2 PRs drift from the spec" }],
  },
  {
    title: "Check test coverage",
    duration: "6.0s",
    steps: [{ title: "Coverage 84%, up 2 points" }],
  },
  {
    title: "Draft release notes",
    duration: "4.3s",
    steps: [{ title: "12 changes in 3 groups" }],
  },
]

export const ANSWER = [
  "Align PR 412 with the retry spec",
  "Add the missing test for PR 418",
  "Release notes are ready to publish",
]
