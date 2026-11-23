import type { Tone } from "@/components/brand/StatusPill"

/** A workflow = one way to solve a type of task, the same way each time. */
export type MockWorkflow = {
  id: string
  name: string
  /** The type of task it solves. */
  solves: string
  /** Names of the inputs a card supplies. */
  inputs: string[]
}

export type RunReason = "First run" | "Rework" | "Card changed"

/** A run links one card to one workflow; a card may run it many times. */
export type MockRun = {
  id: string
  workflowId: string
  cardId: string
  attempt: number
  reason: RunReason
  inputs: Record<string, string>
  tone: Tone
  /** Set once a person answered an approval of this run. */
  decision?: "approved" | "rejected"
  note?: string
  label: string
  ago: string
  duration: string
}

export const WORKFLOWS: MockWorkflow[] = [
  {
    id: "fix-flaky-test",
    name: "Fix flaky test",
    solves: "A test fails intermittently on CI",
    inputs: ["ticket", "test file"],
  },
  {
    id: "weekly-report",
    name: "Weekly report",
    solves: "Summarise a period of merged work for readers",
    inputs: ["period", "audience"],
  },
  {
    id: "triage-inbox",
    name: "Triage inbox",
    solves: "New tickets need a label and an owner",
    inputs: ["queue"],
  },
  {
    id: "release-notes",
    name: "Release notes",
    solves: "A changelog becomes customer-facing notes",
    inputs: ["version", "changelog"],
  },
]

export const RUNS: MockRun[] = [
  {
    id: "r-104", workflowId: "fix-flaky-test", cardId: "fix-flaky-login",
    attempt: 3, reason: "Card changed",
    inputs: { ticket: "US1234", "test file": "login.spec.ts" },
    tone: "working", label: "Running", ago: "3 min ago", duration: "3m",
  },
  {
    id: "r-101", workflowId: "fix-flaky-test", cardId: "fix-flaky-login",
    attempt: 2, reason: "Rework",
    inputs: { ticket: "US1234", "test file": "login.spec.ts" },
    tone: "failed", label: "Failed", ago: "2 days ago", duration: "6m",
  },
  {
    id: "r-097", workflowId: "fix-flaky-test", cardId: "fix-flaky-login",
    attempt: 1, reason: "First run",
    inputs: { ticket: "US1234", "test file": "auth.spec.ts" },
    tone: "done", label: "Done", ago: "5 days ago", duration: "11m",
  },
  {
    id: "r-098", workflowId: "fix-flaky-test", cardId: "refactor-auth-session",
    attempt: 1, reason: "First run",
    inputs: { ticket: "US1301", "test file": "session.spec.ts" },
    tone: "done", label: "Done", ago: "4 days ago", duration: "9m",
  },
  {
    id: "r-103", workflowId: "weekly-report", cardId: "confluence-onboarding",
    attempt: 1, reason: "First run",
    inputs: { period: "Nov 16-22", audience: "Team" },
    tone: "attention", label: "Needs you", ago: "1 hour ago", duration: "4m",
  },
  {
    id: "r-099", workflowId: "release-notes", cardId: "release-notes-v0-4",
    attempt: 1, reason: "First run",
    inputs: { version: "0.4", changelog: "CHANGELOG.md" },
    tone: "done", label: "Done", ago: "yesterday", duration: "5m",
  },
  {
    id: "r-105", workflowId: "fix-flaky-test", cardId: "rally-story-sync",
    attempt: 1, reason: "First run",
    inputs: { ticket: "US2210", "test file": "sync.spec.ts" },
    tone: "attention", label: "Needs you", ago: "20 min ago", duration: "7m",
  },
]
