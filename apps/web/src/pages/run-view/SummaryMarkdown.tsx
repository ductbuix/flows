import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type Props = {
  text: string
}

export function SummaryMarkdown({ text }: Props) {
  return (
    <div
      data-testid="summary-markdown"
      className="prose prose-sm dark:prose-invert max-w-none"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
