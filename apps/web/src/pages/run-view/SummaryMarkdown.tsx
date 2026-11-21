import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  CodeBlock,
  CodeBlockContent,
} from "@workspace/ui/components/code-block"

type Props = {
  text: string
}

function fenceText(children: unknown): string {
  if (typeof children === "string") return children
  if (Array.isArray(children)) return children.map(fenceText).join("")
  if (
    children &&
    typeof children === "object" &&
    "props" in children &&
    (children as { props?: { children?: unknown } }).props
  ) {
    return fenceText(
      (children as { props: { children?: unknown } }).props.children
    )
  }
  return ""
}

const components: Components = {
  a: ({ href, children, ...props }) => {
    if (href?.toLowerCase().startsWith("javascript:")) {
      return <span>{children}</span>
    }
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
  pre: ({ children }) => (
    <CodeBlock size="sm" className="my-2">
      <CodeBlockContent wrap>{fenceText(children)}</CodeBlockContent>
    </CodeBlock>
  ),
  code: ({ className, children, ...props }) => {
    if (className?.includes("language-")) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded-md bg-muted px-1 py-0.5 font-mono text-xs"
        {...props}
      >
        {children}
      </code>
    )
  },
}

export function SummaryMarkdown({ text }: Props) {
  return (
    <div
      data-testid="summary-markdown"
      className="prose prose-sm dark:prose-invert max-w-none"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
