import type { WorkflowInputDecl } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Switch } from "@workspace/ui/components/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"

type Props = {
  index: number
  row: WorkflowInputDecl
  onPatch: (patch: Partial<WorkflowInputDecl>) => void
  onRemove: () => void
}

export function InputDeclRow({ index, row, onPatch, onRemove }: Props) {
  return (
    <Card size="sm" data-testid={`input-decl-${index}`}>
      <FieldGroup>
        <div className="flex items-center justify-between gap-2">
          <FieldDescription>#{index + 1}</FieldDescription>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            data-testid={`input-remove-${index}`}
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
        <Field>
          <FieldLabel htmlFor={`field-input-name-${index}`}>Name</FieldLabel>
          <Input
            id={`field-input-name-${index}`}
            data-testid={`field-input-name-${index}`}
            value={row.name}
            onChange={(e) => onPatch({ name: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel>Type</FieldLabel>
          <Select
            value={row.type}
            onValueChange={(type) => {
              if (type === "text" || type === "markdown" || type === "file") {
                const patch: Partial<WorkflowInputDecl> = { type }
                if (type === "file") patch.default = undefined
                onPatch(patch)
              }
            }}
          >
            <SelectTrigger data-testid={`field-input-type-${index}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">text</SelectItem>
              <SelectItem value="markdown">markdown</SelectItem>
              <SelectItem value="file">file</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor={`field-input-required-${index}`}>
            Required
          </FieldLabel>
          <Switch
            id={`field-input-required-${index}`}
            data-testid={`field-input-required-${index}`}
            checked={row.required}
            onCheckedChange={(required) => onPatch({ required })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`field-input-desc-${index}`}>
            Description
          </FieldLabel>
          <Textarea
            id={`field-input-desc-${index}`}
            data-testid={`field-input-desc-${index}`}
            value={row.description ?? ""}
            rows={2}
            onChange={(e) => {
              const v = e.target.value
              onPatch({ description: v === "" ? undefined : v })
            }}
          />
        </Field>
        {row.type !== "file" && (
          <Field>
            <FieldLabel htmlFor={`field-input-default-${index}`}>
              Default
            </FieldLabel>
            <Input
              id={`field-input-default-${index}`}
              data-testid={`field-input-default-${index}`}
              value={row.default ?? ""}
              onChange={(e) => {
                const v = e.target.value
                onPatch({ default: v === "" ? undefined : v })
              }}
            />
          </Field>
        )}
      </FieldGroup>
    </Card>
  )
}
