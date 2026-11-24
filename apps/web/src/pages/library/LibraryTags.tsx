import { Badge } from "@workspace/ui/components/badge"
import { splitTag } from "./library-filter"

/** `namespace:value`, the namespace muted. */
export function TagBadge({
  tag,
  active,
  onClick,
}: {
  tag: string
  active?: boolean
  onClick?: () => void
}) {
  const [ns, value] = splitTag(tag)
  const body = (
    <>
      <span className={active ? "opacity-70" : "text-muted-foreground"}>
        {ns ? `${ns}:` : null}
      </span>
      {value}
    </>
  )
  if (onClick) {
    return (
      <Badge
        variant={active ? "default" : "outline"}
        render={<button type="button" onClick={onClick} />}
      >
        {body}
      </Badge>
    )
  }
  return <Badge variant="outline">{body}</Badge>
}
