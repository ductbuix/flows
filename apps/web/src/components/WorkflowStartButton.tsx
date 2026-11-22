import { useNavigate } from "react-router"
import { ActionButton } from "@/components/ActionButton"
import { TrustStartGate } from "@/components/TrustStartGate"
import { runPath } from "@/lib/paths"

/** "Start run" header action shared by every workflow tab (DES-029). */
export function WorkflowStartButton({ workflowId }: { workflowId: string }) {
  const navigate = useNavigate()
  return (
    <TrustStartGate
      onStarted={(_wfId, runId) => {
        void navigate(runPath(runId))
      }}
    >
      {({ begin, pending }) => (
        <ActionButton
          data-testid="run-start"
          pending={pending}
          onClick={() => begin({ mode: "start", workflowId })}
        >
          Start run
        </ActionButton>
      )}
    </TrustStartGate>
  )
}
