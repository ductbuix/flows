import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

/** Initials avatar with the name in a tooltip. Mock users have no photos. */
export function UserAvatar({ name }: { name: string }) {
  return (
    <Tooltip>
      {/* eslint-disable-next-line ui-guard/dense-size -- board card footer is a dense place */}
      <TooltipTrigger render={<Avatar size="sm" className="ml-auto" />}>
        <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  )
}
