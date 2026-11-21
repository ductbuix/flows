import type { WorkflowInputDecl } from "@workspace/shared"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

type FilePart = { field: string; file: File }

type Props = {
  decls: WorkflowInputDecl[]
  values: Record<string, string>
  files: FilePart[]
  errors: Record<string, string>
  onChangeValue: (name: string, value: string) => void
  onChangeFile: (field: string, file: File | undefined) => void
  onChangeAttach: (files: File[]) => void
}

function fileByField(files: FilePart[], field: string): File | undefined {
  return files.find((f) => f.field === field)?.file
}

export function StartRunFormFields({
  decls,
  values,
  files,
  errors,
  onChangeValue,
  onChangeFile,
  onChangeAttach,
}: Props) {
  const attachOnly = decls.length === 0
  const attach = files.filter((f) => f.field === "attach").map((f) => f.file)

  return (
    <ScrollArea className="max-h-96">
      <FieldGroup className="pr-3">
        {decls.map((decl) => (
          <Field
            key={decl.name}
            data-invalid={errors[decl.name] ? true : undefined}
          >
            <FieldLabel htmlFor={`start-run-field-${decl.name}`}>
              {decl.name}
              {decl.required ? " *" : ""}
            </FieldLabel>
            {decl.description && (
              <FieldDescription>{decl.description}</FieldDescription>
            )}
            {decl.type === "text" && (
              <Input
                id={`start-run-field-${decl.name}`}
                data-testid={`start-run-field-${decl.name}`}
                value={values[decl.name] ?? ""}
                onChange={(e) => onChangeValue(decl.name, e.target.value)}
              />
            )}
            {decl.type === "markdown" && (
              <Textarea
                id={`start-run-field-${decl.name}`}
                data-testid={`start-run-field-${decl.name}`}
                rows={6}
                className="font-mono text-xs"
                value={values[decl.name] ?? ""}
                onChange={(e) => onChangeValue(decl.name, e.target.value)}
              />
            )}
            {decl.type === "file" && (
              <>
                <Input
                  id={`start-run-field-${decl.name}`}
                  data-testid={`start-run-field-${decl.name}`}
                  type="file"
                  onChange={(e) => onChangeFile(decl.name, e.target.files?.[0])}
                />
                {fileByField(files, decl.name) && (
                  <FieldDescription>
                    {fileByField(files, decl.name)!.name}
                  </FieldDescription>
                )}
              </>
            )}
            {errors[decl.name] && (
              <FieldError
                data-testid={`start-run-error-${decl.name}`}
                errors={[{ message: errors[decl.name] }]}
              />
            )}
          </Field>
        ))}

        {attachOnly && (
          <Field>
            <FieldLabel htmlFor="start-run-attach">
              Attach files (optional)
            </FieldLabel>
            <Input
              id="start-run-attach"
              data-testid="start-run-attach"
              type="file"
              multiple
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : []
                onChangeAttach(list)
              }}
            />
            {attach.length > 0 && (
              <FieldDescription>
                {attach.map((f) => f.name).join(", ")}
              </FieldDescription>
            )}
          </Field>
        )}
      </FieldGroup>
    </ScrollArea>
  )
}

export function clientValidateInputs(
  decls: WorkflowInputDecl[],
  values: Record<string, string>,
  files: FilePart[]
): Record<string, string> | null {
  const errors: Record<string, string> = {}
  for (const decl of decls) {
    if (!decl.required) continue
    if (decl.type === "file") {
      if (!fileByField(files, decl.name)) errors[decl.name] = "required"
      continue
    }
    if ((values[decl.name] ?? "").trim().length === 0) {
      errors[decl.name] = "required"
    }
  }
  return Object.keys(errors).length > 0 ? errors : null
}
