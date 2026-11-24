import { Link } from "react-router"
import { Library } from "lucide-react"
import { useQuery } from "@workspace/sdk-react"

export function ConnectorUsedByTab({ providerId }: { providerId?: string }) {
  const libQ = useQuery("library/list", {}, { topics: ["library"] })
  const lib =
    providerId && libQ.data
      ? libQ.data.items.filter((i) => i.source === providerId)
      : []

  return (
    <div data-testid="connector-used-by" className="flex flex-col gap-4">
      {lib.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing uses this yet. Add it to an agent or script step in a
          workflow.
        </p>
      ) : (
        <Link
          to="/library"
          className="-mx-2 flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted"
          data-testid="connector-used-library"
        >
          <Library className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">Library fetches</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {lib.length} linked {lib.length === 1 ? "item" : "items"}
          </span>
        </Link>
      )}
    </div>
  )
}
