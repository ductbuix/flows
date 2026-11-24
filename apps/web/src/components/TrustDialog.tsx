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
import { TriangleAlert } from "lucide-react"
import { TechnicalChecks } from "@/components/TechnicalChecks"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  trust: TrustDecision
  checks: TrustCheck[]
  /** Agent CLIs the run may launch; names the dialog title. */
  clis?: ("claude" | "cursor")[]
  pending?: boolean
  onTrustOnce: () => void
  onTrustAlways: () => void
  onRun: () => void
}

const CLI_NAME = { claude: "Claude Code", cursor: "Cursor" } as const

/** "Cursor", "Claude Code and Cursor", or "Agents" when unknown. */
export function cliLabel(clis: ("claude" | "cursor")[] = []): string {
  const names = clis.map((id) => CLI_NAME[id])
  return names.length > 0 ? names.join(" and ") : "Agents"
}

/** Allow an agent CLI to run on this Mac, in plain words (DES-029, DES-019). */
export function TrustDialog({
  open,
  onOpenChange,
  trust,
  checks,
  clis,
  pending,
  onTrustOnce,
  onTrustAlways,
  onRun,
}: Props) {
  const needsGrant = trust === "none"
  const who = cliLabel(clis)
  const warnings = checks.filter((c) => c.status !== "pass").length
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="trust-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {needsGrant
              ? `Allow ${who} to run on this Mac?`
              : "Start this run?"}
          </DialogTitle>
          <DialogDescription>
            {needsGrant
              ? `${who} runs your agent tasks. It can change files only in this workflow's folder.`
              : "Agents are already allowed. Open Technical checks to review the warnings."}
          </DialogDescription>
        </DialogHeader>

        <TechnicalChecks warnings={warnings} data-testid="trust-technical">
          <ItemGroup>
            {checks.map((check) => (
              <Item key={check.id} data-testid={`trust-check-${check.id}`}>
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
          {needsGrant && (
            <p className="text-muted-foreground">
              Allowing covers all of FLOWAPP_HOME. Cursor runs with --force,
              which auto-approves tool actions.
            </p>
          )}
        </TechnicalChecks>

        <DialogFooter className="gap-2 sm:justify-end">
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
                variant="outline"
                data-testid="trust-always"
                disabled={pending}
                onClick={onTrustAlways}
              >
                Always allow
              </Button>
              <Button
                data-testid="trust-once"
                disabled={pending}
                onClick={onTrustOnce}
              >
                Allow and start
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
