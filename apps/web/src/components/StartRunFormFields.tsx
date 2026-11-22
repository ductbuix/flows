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
import { Button } from "@workspace/ui/components/button"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@workspace/ui/components/attachment"
import { FileText, Paperclip, X } from "lucide-react"
import { useRef } from "react"

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

type PickerProps = {
  id: string
  testId: string
  multiple?: boolean
  files: File[]
  addLabel: string
  onPick: (files: File[]) => void
  onRemove: (index: number) => void
}

/** "Add files" Button plus Attachment chips; the input stays hidden. */
function FilePicker({
  id,
  testId,
  multiple,
  files,
  addLabel,
  onPick,
  onRemove,
}: PickerProps) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-2">
      <input
        ref={ref}
        id={id}
        data-testid={testId}
        type="file"
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          onPick(e.target.files ? Array.from(e.target.files) : [])
          e.target.value = ""
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => ref.current?.click()}
      >
        <Paperclip data-icon="inline-start" />
        {addLabel}
      </Button>
      {files.length > 0 && (
        <AttachmentGroup className="flex-wrap overflow-visible">
          {files.map((file, i) => (
            <Attachment key={`${file.name}-${i}`} size="sm">
              <AttachmentMedia>
                <FileText />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{file.name}</AttachmentTitle>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onRemove(i)}
                >
                  <X />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ))}
        </AttachmentGroup>
      )}
    </div>
  )
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
                className="font-mono"
                value={values[decl.name] ?? ""}
                onChange={(e) => onChangeValue(decl.name, e.target.value)}
              />
            )}
            {decl.type === "file" && (
              <FilePicker
                id={`start-run-field-${decl.name}`}
                testId={`start-run-field-${decl.name}`}
                files={fileByField(files, decl.name) ? [fileByField(files, decl.name)!] : []}
                addLabel="Add file"
                onPick={(list) => onChangeFile(decl.name, list[0])}
                onRemove={() => onChangeFile(decl.name, undefined)}
              />
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
            <FilePicker
              id="start-run-attach"
              testId="start-run-attach"
              multiple
              files={attach}
              addLabel="Add files"
              onPick={(list) => onChangeAttach([...attach, ...list])}
              onRemove={(i) =>
                onChangeAttach(attach.filter((_, idx) => idx !== i))
              }
            />
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
