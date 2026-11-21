import { CircleXIcon, LayersIcon } from "lucide-react"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@workspace/ui/components/trace"

type Props = {
  error: string
  frames?: string[]
  defaultOpen?: boolean
  "data-testid"?: string
}

/** Stack Trace pattern for a failed attempt (AI Elements). */
export function StackTrace({
  error,
  frames = [],
  defaultOpen = true,
  "data-testid": testId,
}: Props) {
  const appFrames = frames.filter(
    (f) => !f.includes("node_modules") && !f.includes("node:")
  )
  const internalFrames = frames.filter(
    (f) => f.includes("node_modules") || f.includes("node:")
  )
  const shown = appFrames.length > 0 ? appFrames : frames

  return (
    <Trace data-testid={testId}>
      <TraceCollapsible defaultOpen={defaultOpen}>
        <TraceCollapsibleTrigger>
          <TraceLine status="error">
            <TraceIcon>
              <CircleXIcon />
            </TraceIcon>
            <TraceTitle>Failed: {error}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="flex flex-col gap-2">
          <p className="font-mono text-xs text-destructive">{error}</p>
          {shown.length > 0 ? (
            <ol className="flex flex-col gap-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
              {shown.map((frame) => (
                <li key={frame} className="whitespace-nowrap">
                  {frame}
                </li>
              ))}
            </ol>
          ) : null}
          {internalFrames.length > 0 && appFrames.length > 0 ? (
            <TraceCollapsible>
              <TraceCollapsibleTrigger>
                <TraceLine>
                  <TraceIcon>
                    <LayersIcon />
                  </TraceIcon>
                  <TraceTitle>
                    {internalFrames.length} framework frames
                  </TraceTitle>
                </TraceLine>
              </TraceCollapsibleTrigger>
              <TraceCollapsibleContent>
                <ol className="flex flex-col gap-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                  {internalFrames.map((frame) => (
                    <li key={frame} className="whitespace-nowrap">
                      {frame}
                    </li>
                  ))}
                </ol>
              </TraceCollapsibleContent>
            </TraceCollapsible>
          ) : null}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}
