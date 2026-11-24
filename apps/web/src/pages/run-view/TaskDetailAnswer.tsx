import type { RunStep } from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { mono } from "@/components/data/mono"

function show(v: unknown): string {
  if (typeof v === "boolean") return v ? "yes" : "no"
  if (Array.isArray(v)) return v.map(String).join(", ")
  return String(v)
}

/** The named answers of an Agent or LLM step (BL-085), or why they failed. */
export function TaskDetailAnswer({ step }: { step: RunStep | undefined }) {
  if (step?.failReason === "answer") {
    return (
      <Alert variant="destructive" data-testid="task-answer-failed">
        <AlertTitle>Answer did not match</AlertTitle>
        <AlertDescription>
          The step was asked once to fix its answer and it still did not match
          the declared fields.
        </AlertDescription>
      </Alert>
    )
  }
  const entries = Object.entries(step?.answer ?? {})
  if (entries.length === 0) return null
  return (
    <section data-testid="task-answer" className="flex flex-col gap-1.5">
      <h3 className="text-sm font-medium">Answer</h3>
      <dl className="flex flex-col gap-1 rounded-md border px-3 py-2 text-sm">
        {entries.map(([name, value]) => (
          <div
            key={name}
            className="flex gap-4"
            data-testid={`task-answer-${name}`}
          >
            <dt className={`${mono} shrink-0 text-muted-foreground`}>{name}</dt>
            <dd className="min-w-0 flex-1 break-words">{show(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
