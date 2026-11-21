import { useEffect, useState } from "react"
import type {
  PreflightResponse,
  TrustGrant,
  WorkflowInputDecl,
} from "@workspace/shared"
import { toast } from "sonner"
import { clientValidateInputs } from "@/components/StartRunFormFields"
import { loadStartRunForm, type StartRunDraft } from "@/lib/load-start-run-form"
import {
  fetchPreflight,
  planTrustStart,
  startRunWithGrant,
  type StartRunOptions,
} from "@/lib/trust-start"

/** Load form state and run preflight / trust / start for the Overview card. */
export function useOverviewStart(
  workflowId: string,
  onStarted: (runId: string) => void
) {
  const [decls, setDecls] = useState<WorkflowInputDecl[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<{ field: string; file: File }[]>([])
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [draft, setDraft] = useState<StartRunDraft | null>(null)
  const [trust, setTrust] = useState<PreflightResponse | null>(null)
  const [duplicateIds, setDuplicateIds] = useState<string[] | null>(null)
  const [lastGrant, setLastGrant] = useState<TrustGrant | undefined>()

  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(null)
    void loadStartRunForm({ mode: "start", workflowId }).then((result) => {
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
  }, [workflowId])

  function runOptions(
    body: StartRunDraft,
    grant?: TrustGrant,
    confirmDuplicate?: boolean
  ): StartRunOptions {
    return {
      ...(grant !== undefined && { trustGrant: grant }),
      ...(Object.keys(body.values).length > 0 && { values: body.values }),
      ...(body.files.length > 0 && { files: body.files }),
      ...(confirmDuplicate === true && { confirmDuplicate: true }),
    }
  }

  async function execute(
    body: StartRunDraft,
    grant?: TrustGrant,
    confirmDuplicate?: boolean
  ) {
    setLastGrant(grant)
    setPending(true)
    const result = await startRunWithGrant(
      workflowId,
      runOptions(body, grant, confirmDuplicate)
    )
    setPending(false)
    if (result.ok) {
      setTrust(null)
      setDuplicateIds(null)
      setDraft(null)
      onStarted(result.data.runId)
      return
    }
    if (result.kind === "invalid_input") {
      setLocalErrors(result.fields)
      return
    }
    if (result.kind === "duplicate_input") {
      setDraft(body)
      setDuplicateIds(result.detail.existingRunIds)
      return
    }
    toast.error(result.error)
  }

  async function afterSubmit(body: StartRunDraft) {
    setDraft(body)
    setLocalErrors({})
    setPending(true)
    const pre = await fetchPreflight(workflowId)
    if (!pre.ok) {
      setPending(false)
      toast.error(pre.error)
      return
    }
    const plan = planTrustStart(pre.data)
    setPending(false)
    if (plan.kind === "start") {
      await execute(body, plan.grant)
      return
    }
    setTrust(plan.preflight)
  }

  function submit() {
    const v = clientValidateInputs(decls, values, files)
    if (v) {
      setLocalErrors(v)
      return
    }
    void afterSubmit({ values, files })
  }

  return {
    decls,
    values,
    files,
    errors: localErrors,
    loadError,
    loading,
    pending,
    draft,
    trust,
    duplicateIds,
    lastGrant,
    setValues,
    setFiles,
    setTrust,
    setDuplicateIds,
    submit,
    execute,
  }
}
