import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { StartRunFormFields } from "@/components/StartRunFormFields"
import { TrustDialog } from "@/components/TrustDialog"
import { useWorkflows } from "@/lib/workflows-context"
import { useWorkItemStart } from "@/pages/useWorkItemStart"
import { mono } from "@/components/data/mono"

type Props = {
  workItemId: string
  initialWorkflowId?: string
  initialInputs: Record<string, string>
  onStarted: (runId: string) => void
}

/** Work item Start card: workflow Select, prefilled inputs, trust gate. */
export function WorkItemStartCard({
  workItemId,
  initialWorkflowId,
  initialInputs,
  onStarted,
}: Props) {
  const { workflows } = useWorkflows()
  const start = useWorkItemStart({
    workItemId,
    initialWorkflowId,
    initialInputs,
    onStarted,
  })
  const attachOnly = start.decls.length === 0
  const workflowError = start.errors.workflow

  return (
    <>
      <Card size="sm" data-testid="work-item-start-card">
        <CardHeader>
          <CardTitle>Start</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field data-invalid={!!workflowError || undefined}>
            <FieldLabel>Workflow</FieldLabel>
            <Select
              value={start.workflowId || undefined}
              onValueChange={(v) => v && start.setWorkflowId(v)}
            >
              <SelectTrigger data-testid="work-item-start-workflow">
                <SelectValue placeholder="Select a workflow" />
              </SelectTrigger>
              <SelectContent>
                {(workflows ?? []).map((wf) => (
                  <SelectItem key={wf.id} value={wf.id}>
                    {wf.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {workflowError ? <FieldError>{workflowError}</FieldError> : null}
          </Field>
          {!start.workflowId ? (
            <p className="text-sm text-muted-foreground">
              Pick a workflow to load its inputs.
            </p>
          ) : start.loading ? (
            <p className="text-sm text-muted-foreground">Loading workflow…</p>
          ) : start.loadError ? (
            <Alert variant="destructive">
              <AlertDescription>{start.loadError}</AlertDescription>
            </Alert>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {attachOnly
                  ? "Optional files are copied into the run input folder."
                  : "Inputs are prefilled from this work item and stay editable for this run."}
              </p>
              <StartRunFormFields
                decls={start.decls}
                values={start.values}
                files={start.files}
                errors={start.errors}
                onChangeValue={(name, value) =>
                  start.setValues((prev) => ({ ...prev, [name]: value }))
                }
                onChangeFile={(field, file) =>
                  start.setFiles((prev) => [
                    ...prev.filter((f) => f.field !== field),
                    ...(file ? [{ field, file }] : []),
                  ])
                }
                onChangeAttach={(list) =>
                  start.setFiles((prev) => [
                    ...prev.filter((f) => f.field !== "attach"),
                    ...list.map((file) => ({ field: "attach", file })),
                  ])
                }
              />
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button
            data-testid="start-run-submit"
            disabled={
              !start.workflowId ||
              start.loading ||
              !!start.loadError ||
              start.pending
            }
            onClick={() => start.submit()}
          >
            Start
          </Button>
        </CardFooter>
      </Card>

      {start.trust && start.draft && (
        <TrustDialog
          open
          onOpenChange={(open) => {
            if (!open) start.setTrust(null)
          }}
          trust={start.trust.trust}
          checks={start.trust.checks}
          pending={start.pending}
          onTrustOnce={() => void start.execute(start.draft!, "once")}
          onTrustAlways={() => void start.execute(start.draft!, "always")}
          onRun={() => void start.execute(start.draft!)}
        />
      )}
      {start.duplicateIds && start.draft && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) start.setDuplicateIds(null)
          }}
          title="Start anyway?"
          description={
            <>
              A run with the same inputs already exists:{" "}
              <span className={`${mono} text-sm`}>
                {start.duplicateIds.join(", ")}
              </span>
              .
            </>
          }
          confirmLabel="Start anyway"
          cancelLabel="Cancel"
          pending={start.pending}
          onConfirm={() =>
            void start.execute(start.draft!, start.lastGrant, true)
          }
        />
      )}
    </>
  )
}
