import { TerminalIcon } from "lucide-react"
import {
  CodeBlock,
  CodeBlockContent,
} from "@workspace/ui/components/code-block"
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
  title: string
  output: string
  status?: "running" | "error"
  defaultOpen?: boolean
  "data-testid"?: string
}

/** Terminal pattern: command line + streaming output (AI Elements). */
export function Terminal({
  title,
  output,
  status,
  defaultOpen,
  "data-testid": testId,
}: Props) {
  const openWhileRunning = status === "running" && output.length > 0
  return (
    <Trace data-testid={testId}>
      <TraceCollapsible defaultOpen={defaultOpen ?? openWhileRunning}>
        <TraceCollapsibleTrigger>
          <TraceLine status={status}>
            <TraceIcon>
              <TerminalIcon />
            </TraceIcon>
            <TraceTitle>{title}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <CodeBlock size="sm">
            <CodeBlockContent
              wrap
              className="max-h-64"
              data-testid="log-output"
            >
              {output}
            </CodeBlockContent>
          </CodeBlock>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}
