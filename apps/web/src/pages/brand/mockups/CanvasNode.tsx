import type { ReactNode } from "react"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { KindAvatar, type Kind } from "@/components/brand/KindAvatar"

/**
 * Node on the canvas: shadcn Card size=sm (the AI Elements guidance for
 * Node is React Flow + Card). Kind avatar, name, one muted line, inset.
 */
export function CanvasNode({
  icon,
  kind = "soft",
  title,
  subtitle,
  inset,
  selected,
  className,
}: {
  icon: ReactNode
  kind?: Kind
  title: string
  subtitle: string
  inset?: ReactNode
  selected?: boolean
  className?: string
}) {
  return (
    <Card
      size="sm"
      className={cn("w-72", selected && "ring-2 ring-info/40", className)}
      data-testid="canvas-node"
    >
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <KindAvatar kind={kind} size="sm">
            {icon}
          </KindAvatar>
          <div className="flex min-w-0 flex-col">
            <CardTitle className="truncate">{title}</CardTitle>
            <CardDescription className="truncate text-xs">
              {subtitle}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {inset ? (
        <CardContent>
          <div className="rounded-lg bg-muted p-3">{inset}</div>
        </CardContent>
      ) : null}
    </Card>
  )
}

const LABEL_TONE = {
  muted: "",
  info: "border-info/25 bg-info/10 text-info",
  success: "border-success/25 bg-success/10 text-success",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
} as const

/** Edge label: a Badge (outline) on a wire: When this happens, Do this. */
export function EdgeLabel({
  children,
  tone = "muted",
}: {
  children: ReactNode
  tone?: keyof typeof LABEL_TONE
}) {
  return (
    <Badge variant="outline" className={cn("bg-background", LABEL_TONE[tone])}>
      {children}
    </Badge>
  )
}

/** Vertical wire between stacked nodes (React Flow edges in the real app). */
export function Wire({ className }: { className?: string }) {
  return <span aria-hidden className={cn("h-8 w-px bg-border", className)} />
}
