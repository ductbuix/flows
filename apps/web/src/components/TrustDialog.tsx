import type { TrustCheck, TrustDecision } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Item, ItemContent, ItemGroup } from "@workspace/ui/components/item"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { ShieldCheck, TriangleAlert } from "lucide-react"
import { Confirmation } from "@/components/ai-elements/confirmation"

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
      <DialogContent data-testid="trust-dialog" className="sm:max-w-md">
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

        <ScrollArea className="max-h-60">
          <ItemGroup>
            {checks.map((check) => (
              <Item
                key={check.id}
                data-testid={`trust-check-${check.id}`}
              >
                <ItemContent className="flex-row flex-wrap items-center gap-2">
                  {check.status === "pass" ? (
                    <span className="shrink-0 text-muted-foreground">pass</span>
                  ) : (
                    <Badge variant="outline" className="shrink-0 gap-1">
                      <TriangleAlert />
                      warn
                    </Badge>
                  )}
                  <span>{check.message}</span>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </ScrollArea>

        {needsGrant ? (
          <div className="flex flex-col gap-2">
            <Confirmation
              data-testid="trust-confirmation"
              icon={<ShieldCheck />}
              title="Trust agent CLIs for this run?"
              description="Deny cancels. Approve trusts once for this start."
              approveLabel="Trust once"
              denyLabel="Cancel"
              approveTestId="trust-once"
              denyTestId="trust-cancel"
              pending={pending}
              onApprove={onTrustOnce}
              onDeny={() => onOpenChange(false)}
            />
            <Button
              data-testid="trust-always"
              disabled={pending}
              onClick={onTrustAlways}
            >
              Always trust
            </Button>
          </div>
        ) : (
          <Confirmation
            data-testid="trust-confirmation"
            icon={<ShieldCheck />}
            title="Start this run?"
            description="Warnings above are informational."
            approveLabel="Run"
            denyLabel="Cancel"
            approveTestId="trust-run"
            denyTestId="trust-cancel"
            pending={pending}
            onApprove={onRun}
            onDeny={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
