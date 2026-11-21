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
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@workspace/ui/components/trace"

export type TaskStep = {
  title: string
  status?: "running" | "error"
  "data-testid"?: string
}

type Props = {
  title: string
  status?: "running" | "error"
  steps: TaskStep[]
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
                  <StatusIcon status={step.status} />
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
