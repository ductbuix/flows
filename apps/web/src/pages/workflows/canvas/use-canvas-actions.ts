import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react"
import type { Workflow } from "@workspace/contracts"
import type { FlowActions } from "./flow-context"
import type { useCanvasOps } from "./use-canvas-ops"
import type { useRunOverlay } from "./use-run-overlay"
import type { useSystemPrompt } from "./use-system-prompt"

type Options = {
  workflowId: string
  workflow: Workflow
  ops: ReturnType<typeof useCanvasOps>
  overlay: ReturnType<typeof useRunOverlay>
  system: Pick<ReturnType<typeof useSystemPrompt>, "load" | "clear">
  setSettingsId: Dispatch<SetStateAction<string | null>>
  setLogNodeId: Dispatch<SetStateAction<string | null>>
}

/** Card actions provided through FlowContext to the workflow nodes. */
export function useCanvasActions({
  workflowId,
  workflow,
  ops,
  overlay,
  system,
  setSettingsId,
  setLogNodeId,
}: Options) {
  const { update, duplicate, remove } = ops
  const { readOnly, onRetry, runId, inbox } = overlay
  const { load: loadSystem, clear: clearSystem } = system
  const openSettings = useCallback(
    (id: string) => {
      setSettingsId(id)
      const n = workflow.nodes.find((x) => x.id === id)
      if (n?.kind === "llm") loadSystem(id)
      else clearSystem()
    },
    [workflow.nodes, setSettingsId, loadSystem, clearSystem]
  )
  return useMemo<FlowActions>(
    () => ({
      update,
      workflowId,
      run: () => {},
      runAll: () => {},
      readOnly,
      duplicate,
      openSettings,
      remove,
      retry: onRetry ? (id) => void onRetry(id) : undefined,
      openLogs: runId ? setLogNodeId : undefined,
      inbox,
    }),
    [
      update,
      duplicate,
      remove,
      openSettings,
      readOnly,
      onRetry,
      runId,
      inbox,
      workflowId,
      setLogNodeId,
    ]
  )
}
