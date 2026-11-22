import { useEffect, useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"
import {
  connectionsListSchema,
  connectorsListSchema,
  libraryListSchema,
  type AssetResource,
  type ConnectionListItem,
  type ConnectorDescribe,
  type LibraryEntity,
} from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import {
  FieldDescription,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { FreshnessBadge } from "@/components/data/FreshnessBadge"
import { api } from "@/lib/api"

type Props = {
  resources: readonly AssetResource[]
  onChange: (resources: AssetResource[]) => void
}

const keyOf = (r: AssetResource) => `${r.connection}/${r.entity}/${r.id}`

/** Connections, connector kinds and pulled library data for the picker. */
function usePickerData() {
  const [connections, setConnections] = useState<ConnectionListItem[]>([])
  const [connectors, setConnectors] = useState<ConnectorDescribe[]>([])
  const [entities, setEntities] = useState<LibraryEntity[]>([])
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [c, k, l] = await Promise.all([
          api.connections.$get(),
          api.connectors.$get(),
          api.library.$get(),
        ])
        if (!alive) return
        if (c.ok)
          setConnections(connectionsListSchema.parse(await c.json()).connections)
        if (k.ok)
          setConnectors(connectorsListSchema.parse(await k.json()).connectors)
        if (l.ok) setEntities(libraryListSchema.parse(await l.json()).entities)
      } catch {
        // The picker stays empty; chips still show.
      }
    })()
    return () => {
      alive = false
    }
  }, [])
  return { connections, connectors, entities }
}

/**
 * The Asset's resources: chips with freshness, and a picker grouped by
 * connection with search (DES-032). Pulled library data is listed; any
 * id can be typed and added as one of the connector's entity kinds.
 */
export function AssetResources({ resources, onChange }: Props) {
  const { connections, connectors, entities } = usePickerData()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const chosen = new Set(resources.map(keyOf))
  const freshness = new Map(
    entities.map((e) => [`${e.connection}/${e.kind}/${e.entityId}`, e.fresh])
  )
  const add = (r: AssetResource) => {
    if (!chosen.has(keyOf(r))) onChange([...resources, r])
    setOpen(false)
    setQuery("")
  }
  const typed = query.trim()
  return (
    <FieldSet data-testid="asset-resources">
      <FieldLegend variant="label">Resources</FieldLegend>
      {resources.length === 0 ? (
        <FieldDescription>
          No resources. The run pins each one when it starts.
        </FieldDescription>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {resources.map((r, i) => {
            const fresh = freshness.get(keyOf(r))
            return (
              <li
                key={keyOf(r)}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
                data-testid={`asset-resource-${i}`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {r.connection} / {r.entity} / {r.id}
                </span>
                {fresh === undefined ? (
                  <Badge variant="outline" data-testid={`asset-fresh-${i}`}>
                    Not pulled
                  </Badge>
                ) : (
                  <FreshnessBadge
                    fresh={fresh}
                    data-testid={`asset-fresh-${i}`}
                  />
                )}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${r.id}`}
                  data-testid={`asset-remove-${i}`}
                  onClick={() => onChange(resources.filter((_, j) => j !== i))}
                >
                  <XIcon />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setQuery("")
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="asset-picker-open"
            />
          }
        >
          <PlusIcon data-icon="inline-start" />
          Add resource
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" data-testid="asset-picker">
          <Command>
            <CommandInput
              placeholder="Search or type an id"
              data-testid="asset-picker-search"
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {connections.length === 0
                  ? "No connections yet."
                  : "No match. Type an id to add it."}
              </CommandEmpty>
              {connections.map((conn) => {
                const kinds =
                  connectors.find((k) => k.id === conn.connector)
                    ?.entityKinds ?? []
                const pulled = entities.filter(
                  (e) => e.connection === conn.id
                )
                return (
                  <CommandGroup
                    key={conn.id}
                    heading={conn.name}
                    data-testid={`asset-group-${conn.id}`}
                  >
                    {pulled.map((e) => (
                      <CommandItem
                        key={`${e.kind}/${e.entityId}`}
                        value={`${conn.id} ${e.kind} ${e.entityId} ${e.title}`}
                        data-testid={`asset-pick-${conn.id}-${e.kind}-${e.entityId}`}
                        onSelect={() =>
                          add({
                            connection: conn.id,
                            entity: e.kind,
                            id: e.entityId,
                          })
                        }
                        disabled={chosen.has(
                          keyOf({
                            connection: conn.id,
                            entity: e.kind,
                            id: e.entityId,
                          })
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {e.title}{" "}
                          <span className="text-xs text-muted-foreground">
                            {e.kind}/{e.entityId}
                          </span>
                        </span>
                        <FreshnessBadge
                          fresh={e.fresh}
                          data-testid={`asset-pick-fresh-${conn.id}-${e.entityId}`}
                        />
                      </CommandItem>
                    ))}
                    {typed
                      ? kinds.map((kind) => (
                          <CommandItem
                            key={`new-${kind}`}
                            value={`${conn.id} ${typed}`}
                            data-testid={`asset-use-${conn.id}-${kind}`}
                            onSelect={() =>
                              add({
                                connection: conn.id,
                                entity: kind,
                                id: typed,
                              })
                            }
                          >
                            <PlusIcon />
                            Use {typed} as {kind}
                          </CommandItem>
                        ))
                      : null}
                  </CommandGroup>
                )
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FieldSet>
  )
}
