import { Link } from "react-router"
import { KeyRound } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import { connectionPath } from "@/lib/paths"

export type ExpiredSignIn = {
  id: string
  name: string
  message: string
}

type Props = {
  items: ExpiredSignIn[]
}

/** Expired connection sign-ins in Home Needs you (BL-045). */
export function ExpiredSignIns({ items }: Props) {
  if (items.length === 0) return null
  return (
    <>
      {items.map((item) => (
        <Item
          key={item.id}
          variant="outline"
          size="sm"
          data-testid={`home-needs-you-connection-${item.id}`}
        >
          <ItemMedia variant="icon">
            <KeyRound />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{item.name}</ItemTitle>
            <ItemDescription>{item.message}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              size="sm"
              variant="outline"
              render={<Link to={connectionPath(item.id)} />}
              data-testid={`home-fix-signin-${item.id}`}
            >
              Fix sign-in
            </Button>
          </ItemActions>
        </Item>
      ))}
    </>
  )
}
