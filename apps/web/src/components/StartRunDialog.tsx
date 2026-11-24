import { useEffect, useMemo, useState } from "react"
import {
  workItemDetailSchema,
  workItemSummarySchema,
  type WorkflowInputDecl,
  type WorkItemSummary,
} from "@workspace/shared"
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
import { Spinner } from "@workspace/ui/components/spinner"
import { EntityCombobox } from "@/components/EntityCombobox"
import {
  clientValidateInputs,
  StartRunFormFields,
} from "@/components/StartRunFormFields"
import { api } from "@/lib/api"
import { loadStartRunForm, type StartRunDraft } from "@/lib/load-start-run-form"
import { useWorkflows } from "@/lib/workflows-context"

export const WORK_ITEM_NONE = "__none__"

/**
 * `start` from a work item sets `workItemId` (asks for the workflow); `start`
 * from a workflow leaves it unset (asks for the work item or None).
 */
export type StartDialogTarget =
  | {
      mode: "start"
      workflowId?: string
      workItemId?: string
      /** Run step or Run from here: no input form, builds on the latest run (BL-102). */
      partial?: { only: string } | { from: string }
    }
  | { mode: "rerun"; runId: string; workflowId: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: StartDialogTarget
  fieldErrors?: Record<string, string>
  pending?: boolean
  onSubmit: (draft: StartRunDraft) => void
}

type FormFile = { field: string; file: File }

type FormLoaded = {
  workflowId: string
  runId?: string
  decls: WorkflowInputDecl[]
  baseValues: Record<string, string>
  files: FormFile[]
}

type FormFailed = {
  workflowId: string
  runId?: string
  error: string
}

function mergePrefills(
  base: Record<string, string>,
  decls: WorkflowInputDecl[],
  prefills: Record<string, string>
): Record<string, string> {
  const next = { ...base }
  for (const decl of decls) {
    const saved = prefills[decl.name]
    if (saved !== undefined) next[decl.name] = saved
  }
  return next
}

function sameFormTarget(
  loaded: FormLoaded | FormFailed,
  workflowId: string,
  runId: string | undefined
): boolean {
  return loaded.workflowId === workflowId && loaded.runId === runId
}

/** The one Start / rerun dialog: pickers, inputs, files (DES-029, DES-021). */
export function StartRunDialog({
  open,
  onOpenChange,
  target,
  fieldErrors,
  pending,
  onSubmit,
}: Props) {
  const { workflows } = useWorkflows()
  const rerun = target.mode === "rerun"
  const fromWorkItem =
    target.mode === "start" && target.workItemId !== undefined
  const askWorkflow = fromWorkItem
  const askWorkItem = target.mode === "start" && !fromWorkItem

  const [workflowId, setWorkflowId] = useState(target.workflowId ?? "")
  const [workItemId, setWorkItemId] = useState<string | null>(
    target.mode === "start" ? (target.workItemId ?? null) : null
  )
  const [workItems, setWorkItems] = useState<WorkItemSummary[]>([])
  const [prefillLoaded, setPrefillLoaded] = useState<{
    id: string
    values: Record<string, string>
  } | null>(null)
  const [formLoaded, setFormLoaded] = useState<FormLoaded | FormFailed | null>(
    null
  )
  const [fileEdits, setFileEdits] = useState<{
    key: string
    files: FormFile[]
  } | null>(null)
  const [valueEdits, setValueEdits] = useState<{
    key: string
    values: Record<string, string>
  } | null>(null)
  const [localErrorState, setLocalErrorState] = useState<{
    key: string
    errors: Record<string, string>
  } | null>(null)

  const runId = target.mode === "rerun" ? target.runId : undefined
  const formKey = `${workflowId}\0${runId ?? ""}`

  useEffect(() => {
    if (!open || !askWorkItem) return
    let alive = true
    void (async () => {
      try {
        const res = await api.workitems.$get()
        if (!res.ok) return
        const list = workItemSummarySchema.array().parse(await res.json())
        if (alive) setWorkItems(list)
      } catch {
        /* The dialog still works without the list. */
      }
    })()
    return () => {
      alive = false
    }
  }, [open, askWorkItem])

  useEffect(() => {
    if (!open || !workItemId) return
    const requested = workItemId
    let alive = true
    void (async () => {
      try {
        const res = await api.workitems[":id"].$get({
          param: { id: requested },
        })
        if (!res.ok || !alive) return
        const detail = workItemDetailSchema.parse(await res.json())
        if (alive)
          setPrefillLoaded({ id: requested, values: detail.item.inputs })
      } catch {
        if (alive) setPrefillLoaded({ id: requested, values: {} })
      }
    })()
    return () => {
      alive = false
    }
  }, [open, workItemId])

  useEffect(() => {
    if (!open || !workflowId) return
    const requestedWorkflowId = workflowId
    const requestedRunId = runId
    let alive = true
    const loadTarget =
      requestedRunId !== undefined
        ? ({
            mode: "rerun",
            runId: requestedRunId,
            workflowId: requestedWorkflowId,
          } as const)
        : ({ mode: "start", workflowId: requestedWorkflowId } as const)
    void loadStartRunForm(loadTarget).then((result) => {
      if (!alive) return
      if ("error" in result) {
        setFormLoaded({
          workflowId: requestedWorkflowId,
          runId: requestedRunId,
          error: result.error,
        })
        return
      }
      setFormLoaded({
        workflowId: requestedWorkflowId,
        runId: requestedRunId,
        decls: result.decls,
        baseValues: result.values,
        files: result.files,
      })
      setFileEdits({
        key: `${requestedWorkflowId}\0${requestedRunId ?? ""}`,
        files: result.files,
      })
    })
    return () => {
      alive = false
    }
  }, [open, workflowId, runId])

  const formMatch =
    formLoaded && sameFormTarget(formLoaded, workflowId, runId)
      ? formLoaded
      : null
  const loading = !!open && !!workflowId && !formMatch
  const loadError = formMatch && "error" in formMatch ? formMatch.error : null
  const loadedOk = formMatch && !("error" in formMatch) ? formMatch : null
  const decls = loadedOk ? loadedOk.decls : []
  const loadedFiles = loadedOk ? loadedOk.files : []

  const files = fileEdits?.key === formKey ? fileEdits.files : loadedFiles

  const baseline = useMemo(() => {
    const prefills =
      workItemId && prefillLoaded?.id === workItemId ? prefillLoaded.values : {}
    const baseValues = loadedOk ? loadedOk.baseValues : {}
    const formDecls = loadedOk ? loadedOk.decls : []
    return mergePrefills(baseValues, formDecls, prefills)
  }, [workItemId, prefillLoaded, loadedOk])
  const valuesKey = `${formKey}\0${workItemId ?? ""}\0${JSON.stringify(baseline)}`
  const values = valueEdits?.key === valuesKey ? valueEdits.values : baseline

  const localErrors =
    localErrorState?.key === formKey ? localErrorState.errors : {}
  const errors = { ...localErrors, ...fieldErrors }
  const attachOnly = decls.length === 0

  const workflowOptions = useMemo(
    () => (workflows ?? []).map((wf) => ({ value: wf.id, label: wf.id })),
    [workflows]
  )
  const workItemOptions = useMemo(
    () => [
      { value: WORK_ITEM_NONE, label: "None, ad hoc" },
      ...workItems.map((item) => ({ value: item.id, label: item.title })),
    ],
    [workItems]
  )

  function setValues(next: Record<string, string>) {
    setValueEdits({ key: valuesKey, values: next })
  }

  function setLocalErrors(next: Record<string, string>) {
    setLocalErrorState({ key: formKey, errors: next })
  }

  function setFileField(field: string, file: File | undefined) {
    const prev = files
    setFileEdits({
      key: formKey,
      files: [
        ...prev.filter((f) => f.field !== field),
        ...(file ? [{ field, file }] : []),
      ],
    })
  }

  function setAttachList(list: File[]) {
    const prev = files
    setFileEdits({
      key: formKey,
      files: [
        ...prev.filter((f) => f.field !== "attach"),
        ...list.map((file) => ({ field: "attach", file })),
      ],
    })
  }

  function submit() {
    if (!workflowId) {
      setLocalErrors({ workflow: "Pick a workflow" })
      return
    }
    const v = clientValidateInputs(decls, values, files)
    if (v) {
      setLocalErrors(v)
      return
    }
    setLocalErrors({})
    onSubmit({ values, files, workflowId, workItemId })
  }

  const description = rerun
    ? "Inputs are copied from the earlier run and stay editable."
    : !workflowId
      ? "Pick a workflow to load its inputs."
      : attachOnly
        ? "Optional files are copied into the run input folder."
        : workItemId
          ? "Inputs are prefilled from the work item and stay editable for this run."
          : "Fill required fields before the run starts."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="start-run-form">
        <DialogHeader>
          <DialogTitle>{rerun ? "Rerun with inputs" : "Start run"}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {askWorkflow && (
          <EntityCombobox
            label="Workflow"
            options={workflowOptions}
            value={workflowId || null}
            onChange={(v) => setWorkflowId(v ?? "")}
            placeholder="Select a workflow"
            testId="start-run-workflow"
            error={errors.workflow}
            disabled={pending}
          />
        )}
        {askWorkItem && (
          <EntityCombobox
            label="Work item"
            options={workItemOptions}
            value={workItemId ?? WORK_ITEM_NONE}
            onChange={(v) =>
              setWorkItemId(v === null || v === WORK_ITEM_NONE ? null : v)
            }
            placeholder="None, ad hoc"
            testId="start-run-work-item"
            disabled={pending}
          />
        )}

        {loading && (
          <p className="text-sm text-muted-foreground">Loading workflow…</p>
        )}
        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {workflowId && !loading && !loadError && (
          <StartRunFormFields
            decls={decls}
            values={values}
            files={files}
            errors={errors}
            onChangeValue={(name, value) =>
              setValues({ ...values, [name]: value })
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
            disabled={!workflowId || loading || !!loadError || pending}
            onClick={() => submit()}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {rerun ? "Rerun" : "Start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
