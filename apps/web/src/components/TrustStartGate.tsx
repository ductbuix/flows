import { useState } from "react"
import type { PreflightResponse, TrustGrant } from "@workspace/shared"
import { toast } from "sonner"
import { TrustDialog } from "@/components/TrustDialog"
import {
  fetchPreflight,
  planTrustStart,
  rerunWithGrant,
  startRunWithGrant,
} from "@/lib/trust-start"

type StartTarget =
  | { mode: "start"; workflowId: string }
  | { mode: "rerun"; runId: string; workflowId: string }

type Props = {
  children: (opts: {
    begin: (target: StartTarget) => void
    pending: boolean
  }) => React.ReactNode
  onStarted: (workflowId: string, runId: string) => void
}

/** PrefLights, shows the trust dialog when needed, then starts/reruns. */
export function TrustStartGate({ children, onStarted }: Props) {
  const [pending, setPending] = useState(false)
  const [dialog, setDialog] = useState<{
    target: StartTarget
    preflight: PreflightResponse
  } | null>(null)

  async function execute(target: StartTarget, grant?: TrustGrant) {
    setPending(true)
    const result =
      target.mode === "start"
        ? await startRunWithGrant(target.workflowId, grant)
        : await rerunWithGrant(target.runId, grant)
    setPending(false)
    setDialog(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    onStarted(target.workflowId, result.data.runId)
  }

  async function begin(target: StartTarget) {
    setPending(true)
    const pre = await fetchPreflight(target.workflowId)
    if (!pre.ok) {
      setPending(false)
      toast.error(pre.error)
      return
    }
    const plan = planTrustStart(pre.data)
    if (plan.kind === "start") {
      await execute(target)
      return
    }
    setPending(false)
    setDialog({ target, preflight: plan.preflight })
  }

  return (
    <>
      {children({ begin, pending })}
      {dialog && (
        <TrustDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
          trust={dialog.preflight.trust}
          checks={dialog.preflight.checks}
          pending={pending}
          onTrustOnce={() => void execute(dialog.target, "once")}
          onTrustAlways={() => void execute(dialog.target, "always")}
          onRun={() => void execute(dialog.target)}
        />
      )}
    </>
  )
}
