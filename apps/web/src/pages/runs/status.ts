import type { RunStatus } from "@workspace/contracts"
import type { Tone } from "@/components/brand/StatusPill"

/** Status → StatusPill for the mock Runs list (CardRunsSection look). */
export function statusOf(
  status: RunStatus,
  needsYou: boolean
): { tone: Tone; label: string } {
  if (needsYou) return { tone: "attention", label: "Needs you" }
  switch (status) {
    case "queued":
      return { tone: "idle", label: "Queued" }
    case "running":
      return { tone: "working", label: "Running" }
    case "succeeded":
      return { tone: "done", label: "Done" }
    case "failed":
      return { tone: "failed", label: "Failed" }
    case "cancelled":
      return { tone: "idle", label: "Cancelled" }
  }
}
