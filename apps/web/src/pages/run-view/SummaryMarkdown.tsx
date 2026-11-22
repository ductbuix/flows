import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  CodeBlock,
  CodeBlockContent,
} from "@workspace/ui/components/code-block"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { mono } from "@/components/data/mono"

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
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 font-heading text-xl font-medium first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 font-heading text-base font-medium first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1 text-sm font-medium">{children}</h3>
  ),
  p: ({ children }) => <p className="my-2 text-sm">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc pl-5 text-sm">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal pl-5 text-sm">{children}</ol>
  ),
  table: ({ children }) => <Table className="my-2">{children}</Table>,
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableHead>{children}</TableHead>,
  td: ({ children }) => <TableCell>{children}</TableCell>,
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
        className={`${mono} rounded-md bg-muted px-1 py-0.5 text-xs`}
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
      className="max-w-none"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
