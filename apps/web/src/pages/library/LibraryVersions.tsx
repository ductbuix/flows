import type { LibItem } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

/** Every fetch is a version. Tasks read the current one; pin freezes it. */
export function LibraryVersions({
  item,
  busy,
  onPin,
}: {
  item: LibItem
  busy?: boolean
  onPin: (n: number) => void
}) {
  return (
    <div className="flex flex-col gap-1" data-testid="library-versions">
      <p className="pb-2 text-sm text-muted-foreground">
        {item.source === "local"
          ? "Not linked to a remote, so there is nothing to fetch."
          : "Tasks read the current version. Fetch adds a new one; pin an older one to freeze what tasks see."}
      </p>
      {item.versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No versions yet</p>
      ) : (
        item.versions.map((v) => (
          <div
            key={v.n}
            className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-muted"
            data-testid={`library-version-${v.n}`}
          >
            <span className="w-8 text-sm font-medium tabular-nums">v{v.n}</span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm">{v.note}</span>
              <span className="text-xs text-muted-foreground">
                {v.at.slice(0, 19).replace("T", " ")}
              </span>
            </div>
            {v.n === item.current ? (
              <Badge variant="secondary">Current</Badge>
            ) : (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => onPin(v.n)}
                data-testid={`library-pin-${v.n}`}
              >
                Use this
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
