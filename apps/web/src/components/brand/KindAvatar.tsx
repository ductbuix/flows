import type { ReactNode } from "react"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"

export type Kind = "solid" | "soft" | "info" | "success" | "warning"

const FALLBACK: Record<Kind, string> = {
  solid: "bg-primary text-primary-foreground",
  soft: "bg-muted text-foreground",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
}

/**
 * shadcn Avatar with an icon and a kind tint. Names an object: a run, node
 * kind, agent or app. The only addition to Avatar is the tint map.
 */
export function KindAvatar({
  kind = "soft",
  size,
  children,
}: {
  kind?: Kind
  size?: "sm" | "default" | "lg"
  children: ReactNode
}) {
  return (
    <Avatar size={size}>
      <AvatarFallback className={FALLBACK[kind]}>{children}</AvatarFallback>
    </Avatar>
  )
}
