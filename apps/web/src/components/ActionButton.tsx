import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import type { ComponentProps } from "react"

type Props = ComponentProps<typeof Button> & {
  /** Shown in a Tooltip when the button is disabled. */
  disabledReason?: string
  /** Shown in a Tooltip when the button is enabled. */
  tooltip?: string
  pending?: boolean
}

/** Button with optional Tooltip for disabled reasons or hints (DES-011). */
export function ActionButton({
  disabledReason,
  tooltip,
  pending,
  disabled,
  children,
  ...props
}: Props) {
  const isDisabled = Boolean(disabled || pending)
  const tip = isDisabled ? disabledReason : tooltip
  const button = (
    <Button disabled={isDisabled} {...props}>
      {pending ? <Spinner data-icon="inline-start" /> : null}
      {children}
    </Button>
  )

  if (!tip) return button

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {button}
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}
