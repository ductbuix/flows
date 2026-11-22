import { useEffect, useState } from "react"
import { Link2 } from "lucide-react"
import type { LibraryEntity, WorkItem, WorkItemLink } from "@workspace/shared"
import { libraryListSchema, workItemDetailSchema } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "sonner"
import { PageSection } from "@/components/page"
import { api } from "@/lib/api"
import {
  entityKey,
  linkKey,
  WorkItemContextTable,
} from "@/pages/WorkItemContextTable"

type Props = {
  workItemId: string
  item: WorkItem
  hash: string
  onUpdated: (item: WorkItem, hash: string) => void
}

export function WorkItemContextSection({
  workItemId,
  item,
  hash,
  onUpdated,
}: Props) {
  const [entities, setEntities] = useState<LibraryEntity[]>([])
  const [pick, setPick] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.library.$get()
      if (!alive || !res.ok) return
      const body = libraryListSchema.parse(await res.json())
      setEntities(body.entities)
    })()
    return () => {
      alive = false
    }
  }, [])

  const linked = new Set(item.links.map(linkKey))
  const available = entities.filter((e) => !linked.has(entityKey(e)))

  async function saveLinks(links: WorkItemLink[]) {
    setBusy(true)
    try {
      const res = await api.workitems[":id"].$put({
        param: { id: workItemId },
        json: {
          title: item.title,
          workflowId: item.workflowId,
          inputs: item.inputs,
          links,
          baseHash: hash,
        },
      })
      if (!res.ok) {
        toast.error("Could not save library links")
        return
      }
      const detail = workItemDetailSchema.parse(await res.json())
      onUpdated(detail.item, detail.hash)
      toast.success("Context updated")
    } finally {
      setBusy(false)
    }
  }

  function addLink() {
    const entity = available.find((e) => entityKey(e) === pick)
    if (!entity) return
    void saveLinks([
      ...item.links,
      {
        connection: entity.connection,
        kind: entity.kind,
        entityId: entity.entityId,
      },
    ]).then(() => setPick(""))
  }

  return (
    <PageSection title="Context">
      {item.links.length === 0 ? (
        <Empty data-testid="work-item-context-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Link2 />
            </EmptyMedia>
            <EmptyTitle>No linked library data</EmptyTitle>
            <EmptyDescription>
              Pick an entity from the Library to attach as context.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <WorkItemContextTable
          links={item.links}
          entities={entities}
          busy={busy}
          onRemove={(link) => {
            void saveLinks(
              item.links.filter((l) => linkKey(l) !== linkKey(link))
            )
          }}
        />
      )}
      <Field className="mt-3">
        <FieldLabel>Add from Library</FieldLabel>
        <div className="flex gap-2">
          <Select
            value={pick || undefined}
            onValueChange={(v) => v && setPick(v)}
          >
            <SelectTrigger data-testid="work-item-link-select">
              <SelectValue placeholder="Pick a library entity" />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No entities available
                </SelectItem>
              ) : (
                available.map((entity) => (
                  <SelectItem key={entityKey(entity)} value={entityKey(entity)}>
                    {entity.title} ({entity.connection})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="work-item-link-add"
            disabled={busy || !pick}
            onClick={addLink}
          >
            Add
          </Button>
        </div>
      </Field>
    </PageSection>
  )
}
