import type { ConnectorAuth, ConnectorStatus } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { formatRelative } from "@/lib/labels"
import { SIGN_IN, StatusBadge } from "./connector-parts"

export function ConnectorStatusCard({
  status,
  auth,
  checkedAt,
  busy,
  onAction,
}: {
  status: ConnectorStatus
  auth: ConnectorAuth
  checkedAt?: string
  busy: boolean
  onAction: () => void
}) {
  const checkedLabel = checkedAt
    ? `checked ${formatRelative(checkedAt)}`
    : "checked never"

  return (
    <div className="mx-4 flex flex-col gap-2 rounded-2xl bg-muted/50 p-3 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2">
        <StatusBadge status={status} />
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {checkedLabel}
        </span>
        <Button
          variant={status === "connected" ? "outline" : "default"}
          disabled={busy}
          onClick={onAction}
          data-testid="connector-action"
        >
          {busy ? <Spinner /> : null}
          {busy ? "Working…" : status === "connected" ? "Test" : SIGN_IN[auth]}
        </Button>
      </div>
      {status === "expired" ? (
        <p className="text-xs text-muted-foreground">
          Cookies expire on their own. Steps that use this connector wait for a
          sign-in instead of failing.
        </p>
      ) : null}
    </div>
  )
}
