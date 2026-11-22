import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { StartRunFormFields } from "@/components/StartRunFormFields"
import { TrustDialog } from "@/components/TrustDialog"
import { WorkItemSelect } from "@/components/WorkItemSelect"
import { useOverviewStart } from "@/pages/useOverviewStart"
import { mono } from "@/components/data/mono"

type Props = {
  workflowId: string
  onStarted: (runId: string) => void
}

/** Overview Start card: work item, form fields, trust / duplicate gates. */
export function WorkflowStartCard({ workflowId, onStarted }: Props) {
  const start = useOverviewStart(workflowId, onStarted)
  const attachOnly = start.decls.length === 0
  const hasWorkItem = start.workItemId !== null

  return (
    <>
      <Card size="sm" data-testid="workflow-start-card">
        <CardHeader>
          <CardTitle>Start</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <WorkItemSelect
            items={start.workItems}
            value={start.workItemId}
            onChange={start.setWorkItemId}
            disabled={start.pending}
          />
          {start.loading && (
            <p className="text-sm text-muted-foreground">Loading workflow…</p>
          )}
          {start.loadError && (
            <Alert variant="destructive">
              <AlertDescription>{start.loadError}</AlertDescription>
            </Alert>
          )}
          {!start.loading && !start.loadError && (
            <>
              <p className="text-sm text-muted-foreground">
                {attachOnly
                  ? "Optional files are copied into the run input folder."
                  : hasWorkItem
                    ? "Inputs are prefilled from the work item and stay editable for this run."
                    : "Fill required fields before the run starts."}
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
            disabled={start.loading || !!start.loadError || start.pending}
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
