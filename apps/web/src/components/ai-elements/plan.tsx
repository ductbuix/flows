import {
  CircleCheckIcon,
  CircleDotIcon,
  CircleIcon,
  RouteIcon,
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

export type PlanStep = {
  title: string
  status: "done" | "running" | "pending"
}

type Props = {
  title: string
  steps: PlanStep[]
  "data-testid"?: string
}

/** Plan pattern: known steps with progress (AI Elements). */
export function Plan({ title, steps, "data-testid": testId }: Props) {
  const done = steps.filter((s) => s.status === "done").length
  const running = steps.some((s) => s.status === "running")
  return (
    <Trace data-testid={testId}>
      <TraceCollapsible defaultOpen>
        <TraceCollapsibleTrigger>
          <TraceLine status={running ? "running" : undefined}>
            <TraceIcon>
              <RouteIcon />
            </TraceIcon>
            <TraceTitle>{title}</TraceTitle>
            <TraceDescription>
              {done} of {steps.length} done
            </TraceDescription>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Trace>
            {steps.map((step) => (
              <TraceLine
                key={step.title}
                status={
                  step.status === "pending"
                    ? "pending"
                    : step.status === "running"
                      ? "running"
                      : undefined
                }
              >
                <TraceIcon>
                  {step.status === "done" ? (
                    <CircleCheckIcon />
                  ) : step.status === "running" ? (
                    <CircleDotIcon />
                  ) : (
                    <CircleIcon />
                  )}
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
