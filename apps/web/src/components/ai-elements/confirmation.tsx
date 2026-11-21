import type { ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"

type Props = {
  title: string
  description?: string
  icon?: ReactNode
  approveLabel?: string
  denyLabel?: string
  onApprove: () => void
  onDeny: () => void
  pending?: boolean
  approveTestId?: string
  denyTestId?: string
  "data-testid"?: string
}

/** Confirmation pattern: approve or deny (AI Elements). */
export function Confirmation({
  title,
  description,
  icon,
  approveLabel = "Approve",
  denyLabel = "Deny",
  onApprove,
  onDeny,
  pending,
  approveTestId,
  denyTestId,
  "data-testid": testId,
}: Props) {
  return (
    <Item variant="outline" size="sm" data-testid={testId}>
      {icon ? <ItemMedia variant="icon">{icon}</ItemMedia> : null}
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        {description ? <ItemDescription>{description}</ItemDescription> : null}
      </ItemContent>
      <ItemActions>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          data-testid={denyTestId}
          onClick={onDeny}
        >
          {denyLabel}
        </Button>
        <Button
          size="sm"
          disabled={pending}
          data-testid={approveTestId}
          onClick={onApprove}
        >
          {approveLabel}
        </Button>
      </ItemActions>
    </Item>
  )
}
