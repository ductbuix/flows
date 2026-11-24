import type { LibItem } from "@workspace/contracts"
import { useQuery } from "@workspace/sdk-react"
import { FolderOpen } from "lucide-react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { mono } from "@/components/data/mono"

/** Files under the current version folder (`library/<id>/v<n>/`). */
export function LibraryFiles({ item }: { item: LibItem }) {
  const prefix = `library/${item.id}/v${item.current}`
  const listQ = useQuery(
    "file/list",
    { path: prefix, limit: 200 },
    { topics: [] }
  )
  const files = (listQ.data?.items ?? []).filter((e) => e.kind === "file")

  return (
    <div className="flex flex-col gap-3" data-testid="library-files">
      <p className={`${mono} min-w-0 truncate text-xs text-muted-foreground`}>
        {prefix}/
      </p>
      {listQ.loading && !listQ.data ? (
        <Skeleton className="h-24 w-full" />
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No files in this version
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {files.map((f) => {
            const name = f.path.startsWith(`${prefix}/`)
              ? f.path.slice(prefix.length + 1)
              : f.path
            return (
              <li
                key={f.path}
                className="flex min-h-8 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted"
              >
                <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                <span className={`${mono} truncate`}>{name}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
