import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"
import { assetResourceSchema, type AssetResource } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

type Props = {
  resources: readonly AssetResource[]
  onChange: (resources: AssetResource[]) => void
}

/** The Asset's resources as a plain list; the picker is BL-099. */
export function AssetResources({ resources, onChange }: Props) {
  const [connection, setConnection] = useState("")
  const [entity, setEntity] = useState("")
  const [id, setId] = useState("")
  const draft = assetResourceSchema.safeParse({
    connection: connection.trim(),
    entity: entity.trim(),
    id: id.trim(),
  })
  const add = () => {
    if (!draft.success) return
    onChange([...resources, draft.data])
    setConnection("")
    setEntity("")
    setId("")
  }
  return (
    <FieldSet data-testid="asset-resources">
      <FieldLegend variant="label">Resources</FieldLegend>
      {resources.length === 0 ? (
        <FieldDescription>
          No resources. The run pins each one when it starts, read only.
        </FieldDescription>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {resources.map((r, i) => (
            <li
              key={`${r.connection}/${r.entity}/${r.id}`}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
              data-testid={`asset-resource-${i}`}
            >
              <span className="min-w-0 flex-1 truncate">
                {r.connection} / {r.entity} / {r.id}
              </span>
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
          ))}
        </ul>
      )}
      <Field>
        <FieldLabel htmlFor="asset-connection">Connection</FieldLabel>
        <Input
          id="asset-connection"
          data-testid="asset-connection"
          placeholder="demo"
          value={connection}
          onChange={(e) => setConnection(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="asset-entity">Entity kind</FieldLabel>
        <Input
          id="asset-entity"
          data-testid="asset-entity"
          placeholder="item"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="asset-id">Entity id</FieldLabel>
        <Input
          id="asset-id"
          data-testid="asset-id"
          placeholder="alpha"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
      </Field>
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="asset-add"
        disabled={!draft.success}
        onClick={add}
      >
        <PlusIcon data-icon="inline-start" />
        Add resource
      </Button>
    </FieldSet>
  )
}
