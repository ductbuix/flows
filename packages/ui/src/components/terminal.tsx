/**
 * Adapted from shadcn apps/v4/examples/base/terminal-demo.tsx (shadcn-ui/ui@bfa64ff).
 * Changed base-rhea to base-nova: imports use @workspace/ui/components/*, not @/styles/base-rhea/ui/*; chat demo wiring (useChat, Bubble, Message) removed.
 */
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
  /** Fill the parent height instead of capping the log at max-h-64. */
  fill?: boolean
  "data-testid"?: string
}

/** Terminal pattern: command line + streaming output (AI Elements). */
export function Terminal({
  title,
  output,
  status,
  defaultOpen,
  fill,
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
              className={fill ? "max-h-none" : "max-h-64"}
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
