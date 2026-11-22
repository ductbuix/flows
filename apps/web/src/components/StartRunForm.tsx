import { useEffect, useState } from "react"
import type { WorkflowInputDecl } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  clientValidateInputs,
  StartRunFormFields,
} from "@/components/StartRunFormFields"
import {
  loadStartRunForm,
  type StartRunDraft,
  type StartRunTarget,
} from "@/lib/load-start-run-form"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: StartRunTarget
  fieldErrors?: Record<string, string>
  pending?: boolean
  onSubmit: (draft: StartRunDraft) => void
}

/** Start / rerun input form before trust and preflight (DES-021). */
export function StartRunForm({
  open,
  onOpenChange,
  target,
  fieldErrors,
  pending,
  onSubmit,
}: Props) {
  const [decls, setDecls] = useState<WorkflowInputDecl[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<{ field: string; file: File }[]>([])
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setLoadError(null)
    setLocalErrors({})
    void loadStartRunForm(target).then((result) => {
      if (!alive) return
      setLoading(false)
      if ("error" in result) {
        setLoadError(result.error)
        return
      }
      setDecls(result.decls)
      setValues(result.values)
      setFiles(result.files)
    })
    return () => {
      alive = false
    }
  }, [open, target])

  useEffect(() => {
    if (fieldErrors) setLocalErrors(fieldErrors)
  }, [fieldErrors])

  const errors = { ...localErrors, ...fieldErrors }
  const attachOnly = decls.length === 0

  function setFileField(field: string, file: File | undefined) {
    setFiles((prev) => [
      ...prev.filter((f) => f.field !== field),
      ...(file ? [{ field, file }] : []),
    ])
  }

  function setAttachList(list: File[]) {
    setFiles((prev) => [
      ...prev.filter((f) => f.field !== "attach"),
      ...list.map((file) => ({ field: "attach", file })),
    ])
  }

  function submit() {
    const v = clientValidateInputs(decls, values, files)
    if (v) {
      setLocalErrors(v)
      return
    }
    setLocalErrors({})
    onSubmit({ values, files })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="start-run-form">
        <DialogHeader>
          <DialogTitle>
            {target.mode === "rerun"
              ? "Rerun with inputs"
              : "Start run with inputs"}
          </DialogTitle>
          <DialogDescription>
            {attachOnly
              ? "Optional files are copied into the run input folder."
              : "Fill required fields before the run starts."}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <p className="text-sm text-muted-foreground">Loading workflow…</p>
        )}
        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {!loading && !loadError && (
          <StartRunFormFields
            decls={decls}
            values={values}
            files={files}
            errors={errors}
            onChangeValue={(name, value) =>
              setValues((prev) => ({ ...prev, [name]: value }))
            }
            onChangeFile={setFileField}
            onChangeAttach={setAttachList}
          />
        )}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            variant="outline"
            data-testid="start-run-cancel"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            data-testid="start-run-submit"
            disabled={loading || !!loadError || pending}
            onClick={() => submit()}
          >
            {target.mode === "rerun" ? "Rerun" : "Start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
