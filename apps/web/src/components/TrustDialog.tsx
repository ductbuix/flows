import type { TrustCheck, TrustDecision } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Item, ItemContent, ItemGroup } from "@workspace/ui/components/item"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { TriangleAlert } from "lucide-react"

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
      <DialogContent data-testid="trust-dialog" className="sm:max-w-lg">
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
                size="sm"
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
