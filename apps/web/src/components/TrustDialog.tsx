import type { TrustCheck, TrustDecision } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  trust: TrustDecision
  checks: TrustCheck[]
  pending?: boolean
  onTrustOnce: () => void
  onTrustAlways: () => void
  onRun: () => void
}

/** Pre-run trust + warn-only checks (DES-019). */
export function TrustDialog({
  open,
  onOpenChange,
  trust,
  checks,
  pending,
  onTrustOnce,
  onTrustAlways,
  onRun,
}: Props) {
  const needsGrant = trust === "none"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="trust-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {needsGrant ? "Trust agent CLIs?" : "Pre-run check"}
          </DialogTitle>
          <DialogDescription>
            {needsGrant
              ? "This run may launch Claude Code or Cursor agent. Trust covers all of FLOWAPP_HOME. Cursor --force auto-approves tool actions. Double check warnings before continuing."
              : "Always-trust is on. Review warnings before running."}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-60 space-y-2 overflow-y-auto text-sm">
          {checks.map((check) => (
            <li
              key={check.id}
              data-testid={`trust-check-${check.id}`}
              className="flex gap-2"
            >
              <span
                className={
                  check.status === "pass"
                    ? "text-muted-foreground"
                    : "font-medium text-amber-700 dark:text-amber-400"
                }
              >
                {check.status === "pass" ? "pass" : "warn"}
              </span>
              <span>{check.message}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-wrap gap-2 sm:justify-end">
          <Button
            variant="outline"
            data-testid="trust-cancel"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {needsGrant ? (
            <>
              <Button
                variant="secondary"
                data-testid="trust-once"
                disabled={pending}
                onClick={onTrustOnce}
              >
                Trust once
              </Button>
              <Button
                data-testid="trust-always"
                disabled={pending}
                onClick={onTrustAlways}
              >
                Always trust
              </Button>
            </>
          ) : (
            <Button data-testid="trust-run" disabled={pending} onClick={onRun}>
              Run
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
