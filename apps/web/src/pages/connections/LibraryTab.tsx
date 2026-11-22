import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import {
  libraryListSchema,
  workItemDetailSchema,
  type LibraryEntity,
  type LibraryUsage,
} from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "sonner"
import { LibraryUsageAlert } from "@/components/LibraryUsageAlert"
import { PageSection } from "@/components/page"
import { api } from "@/lib/api"
import { workItemPath } from "@/lib/paths"
import { LibraryEntityTable } from "./LibraryEntityTable"

export function LibraryTab() {
  const navigate = useNavigate()
  const [entities, setEntities] = useState<LibraryEntity[] | null>(null)
  const [usage, setUsage] = useState<LibraryUsage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await api.library.$get()
      if (!res.ok) throw new Error("failed")
      const body = libraryListSchema.parse(await res.json())
      setEntities(body.entities)
      setUsage(body.usage)
    } catch {
      setError("Could not load library.")
      setEntities([])
      setUsage(null)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function pull(entity: LibraryEntity) {
    const key = `pull:${entity.connection}/${entity.kind}/${entity.entityId}`
    setBusy(key)
    try {
      const res = await api.library.pull.$post({
        json: {
          connection: entity.connection,
          kind: entity.kind,
          entityId: entity.entityId,
        },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string
        } | null
        toast.error(body?.message ?? "Pull failed")
        return
      }
      toast.success("Pulled")
      await load()
    } catch {
      toast.error("Pull failed")
    } finally {
      setBusy(null)
    }
  }

  async function createWorkItem(entity: LibraryEntity) {
    const key = `wi:${entity.connection}/${entity.kind}/${entity.entityId}`
    setBusy(key)
    try {
      const res = await api.workitems.$post({
        json: {
          title: entity.title,
          source: {
            kind: "library",
            connection: entity.connection,
            entityKind: entity.kind,
            entityId: entity.entityId,
          },
          links: [
            {
              connection: entity.connection,
              kind: entity.kind,
              entityId: entity.entityId,
            },
          ],
        },
      })
      if (!res.ok) {
        toast.error("Could not create work item")
        return
      }
      const detail = workItemDetailSchema.parse(await res.json())
      toast.success("Work item created")
      void navigate(workItemPath(detail.item.id))
    } catch {
      toast.error("Could not create work item")
    } finally {
      setBusy(null)
    }
  }

  async function clearUnused(entity: LibraryEntity) {
    const key = `clear:${entity.connection}/${entity.kind}/${entity.entityId}`
    setBusy(key)
    try {
      const res = await api.library.clear.$post({
        json: {
          connection: entity.connection,
          kind: entity.kind,
          entityId: entity.entityId,
        },
      })
      if (!res.ok) {
        toast.error("Clear failed")
        return
      }
      const body = (await res.json()) as { removed?: string[] }
      const n = body.removed?.length ?? 0
      toast.success(
        n === 0
          ? "Nothing to clear"
          : `Cleared ${n} unused revision${n === 1 ? "" : "s"}`
      )
      await load()
    } catch {
      toast.error("Clear failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div data-testid="library-tab">
      <PageSection title="Library">
        {usage ? <LibraryUsageAlert usage={usage} /> : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : entities === null ? (
          <div className="space-y-3" data-testid="library-loading">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : entities.length === 0 ? (
          <Empty data-testid="library-empty">
            <EmptyHeader>
              <EmptyTitle>Nothing pulled yet</EmptyTitle>
              <EmptyDescription>
                Pull from a connection to see entities and revisions here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <LibraryEntityTable
            entities={entities}
            busy={busy}
            onPull={(e) => void pull(e)}
            onClear={(e) => void clearUnused(e)}
            onCreateWorkItem={(e) => void createWorkItem(e)}
          />
        )}
      </PageSection>
    </div>
  )
}
