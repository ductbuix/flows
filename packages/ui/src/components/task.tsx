/**
 * Adapted from shadcn apps/v4/examples/base/task-demo.tsx (shadcn-ui/ui@bfa64ff).
 * Changed base-rhea to base-nova: imports use @workspace/ui/components/*, not @/styles/base-rhea/ui/*; chat demo wiring (useChat, Bubble, Message) removed.
 */
import type { ReactNode } from "react"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
} from "lucide-react"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@workspace/ui/components/trace"

export type TaskStep = {
  title: string
  status?: "running" | "error"
  /** Replaces the status icon (e.g. a search icon for a live action). */
  icon?: ReactNode
  "data-testid"?: string
}

type Props = {
  title: string
  status?: "running" | "error"
  steps: TaskStep[]
  /** Right of the title, e.g. a duration. */
  description?: ReactNode
  defaultOpen?: boolean
  "data-testid"?: string
}

function StatusIcon({ status }: { status?: "running" | "error" }) {
  if (status === "running") {
    return <LoaderCircleIcon className="animate-spin" />
  }
  return status === "error" ? <CircleAlertIcon /> : <CircleCheckIcon />
}

/** Task pattern: steps as the work happens (AI Elements). */
export function Task({
  title,
  status,
  steps,
  description,
  defaultOpen,
  "data-testid": testId,
}: Props) {
  return (
    <Trace data-testid={testId}>
      <TraceCollapsible defaultOpen={defaultOpen ?? status === "running"}>
        <TraceCollapsibleTrigger>
          <TraceLine status={status}>
            <TraceIcon>
              <StatusIcon status={status} />
            </TraceIcon>
            <TraceTitle>{title}</TraceTitle>
            {description ? (
              <TraceDescription>{description}</TraceDescription>
            ) : null}
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent keepMounted>
          <Trace>
            {steps.map((step) => (
              <TraceLine
                key={step.title}
                status={step.status}
                data-testid={step["data-testid"]}
              >
                <TraceIcon>
                  {step.icon ?? <StatusIcon status={step.status} />}
                </TraceIcon>
                <TraceTitle>{step.title}</TraceTitle>
              </TraceLine>
            ))}
          </Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}
