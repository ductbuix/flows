import { useState } from "react"
import type { PreflightResponse, TrustGrant } from "@workspace/shared"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import {
  StartRunDialog,
  type StartDialogTarget,
} from "@/components/StartRunDialog"
import { TrustDialog } from "@/components/TrustDialog"
import type { StartRunDraft } from "@/lib/load-start-run-form"
import {
  fetchPreflight,
  planTrustStart,
  rerunWithGrant,
  startRunWithGrant,
  type StartRunOptions,
} from "@/lib/trust-start"
import { mono } from "@/components/data/mono"

export type StartTarget = StartDialogTarget

function workflowOf(target: StartTarget, body: StartRunDraft): string {
  return body.workflowId ?? target.workflowId ?? ""
}

type Props = {
  children: (opts: {
    begin: (target: StartTarget) => void
    pending: boolean
  }) => React.ReactNode
  onStarted: (workflowId: string, runId: string) => void
}

/** Input form, preflight, trust, duplicate confirm, then start/rerun (DES-021). */
export function TrustStartGate({ children, onStarted }: Props) {
  const [pending, setPending] = useState(false)
  const [pipelineTarget, setPipelineTarget] = useState<StartTarget | null>(null)
  const [formTarget, setFormTarget] = useState<StartTarget | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>()
  const [draft, setDraft] = useState<StartRunDraft | null>(null)
  const [trustDialog, setTrustDialog] = useState<{
    target: StartTarget
    preflight: PreflightResponse
  } | null>(null)
  const [duplicateIds, setDuplicateIds] = useState<string[] | null>(null)
  const [lastGrant, setLastGrant] = useState<TrustGrant | undefined>()

  function runOptions(
    body: StartRunDraft,
    grant?: TrustGrant,
    confirmDuplicate?: boolean
  ): StartRunOptions {
    return {
      ...(body.workItemId ? { workItemId: body.workItemId } : {}),
      ...(grant !== undefined && { trustGrant: grant }),
      ...(Object.keys(body.values).length > 0 && { values: body.values }),
      ...(body.files.length > 0 && { files: body.files }),
      ...(confirmDuplicate === true && { confirmDuplicate: true }),
    }
  }

  async function execute(
    target: StartTarget,
    body: StartRunDraft,
    grant?: TrustGrant,
    confirmDuplicate?: boolean
  ) {
    setLastGrant(grant)
    setPending(true)
    const options = {
      ...runOptions(body, grant, confirmDuplicate),
      ...(target.mode === "start" ? target.partial : {}),
    }
    const workflowId = workflowOf(target, body)
    const result =
      target.mode === "start"
        ? await startRunWithGrant(workflowId, options)
        : await rerunWithGrant(target.runId, options)
    setPending(false)

    if (result.ok) {
      setTrustDialog(null)
      setDuplicateIds(null)
      setFormTarget(null)
      setPipelineTarget(null)
      setDraft(null)
      onStarted(workflowId, result.data.runId)
      return
    }

    if (result.kind === "invalid_input") {
      setFieldErrors(result.fields)
      setFormTarget(target)
      return
    }

    if (result.kind === "duplicate_input") {
      setDraft(body)
      setFormTarget(null)
      setDuplicateIds(result.detail.existingRunIds)
      return
    }

    toast.error(result.error)
  }

  async function afterFormSubmit(target: StartTarget, body: StartRunDraft) {
    setDraft(body)
    setFieldErrors(undefined)
    setPending(true)
    const pre = await fetchPreflight(workflowOf(target, body))
    if (!pre.ok) {
      setPending(false)
      toast.error(pre.error)
      return
    }
    const plan = planTrustStart(pre.data)
    setPending(false)
    if (plan.kind === "start") {
      await execute(target, body, plan.grant)
      return
    }
    setFormTarget(null)
    setTrustDialog({ target, preflight: plan.preflight })
  }

  function begin(target: StartTarget) {
    if (target.mode === "start" && target.partial) {
      // A partial run keeps the inputs of the run it builds on.
      void afterFormSubmit(target, { values: {}, files: [] })
      return
    }
    setPipelineTarget(target)
    setFormTarget(target)
    setFieldErrors(undefined)
  }

  const formOpen = formTarget !== null
  const duplicateTarget = pipelineTarget ?? formTarget

  return (
    <>
      {children({ begin, pending })}
      {formOpen && formTarget && (
        <StartRunDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setFormTarget(null)
              setPipelineTarget(null)
            }
          }}
          target={formTarget}
          fieldErrors={fieldErrors}
          pending={pending}
          onSubmit={(body) => void afterFormSubmit(formTarget, body)}
        />
      )}
      {trustDialog && draft && (
        <TrustDialog
          open
          onOpenChange={(open) => {
            if (!open) setTrustDialog(null)
          }}
          trust={trustDialog.preflight.trust}
          checks={trustDialog.preflight.checks}
          clis={trustDialog.preflight.clis}
          pending={pending}
          onTrustOnce={() => void execute(trustDialog.target, draft, "once")}
          onTrustAlways={() =>
            void execute(trustDialog.target, draft, "always")
          }
          onRun={() => void execute(trustDialog.target, draft)}
        />
      )}
      {duplicateIds && draft && duplicateTarget && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setDuplicateIds(null)
          }}
          title="Start anyway?"
          description={
            <>
              A run with the same inputs already exists:{" "}
              <span className={`${mono} text-sm`}>
                {duplicateIds.join(", ")}
              </span>
              .
            </>
          }
          confirmLabel="Start anyway"
          cancelLabel="Cancel"
          pending={pending}
          onConfirm={() =>
            void execute(duplicateTarget, draft, lastGrant, true)
          }
        />
      )}
    </>
  )
}
