import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { TechnicalChecks } from "@/components/TechnicalChecks"
import { mono } from "@/components/data/mono"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverKey: string
  pending?: boolean
  onTrustOnce: () => void
  onTrustAlways: () => void
}

/** Allow a local MCP server once or always (DES-029, DES-026 / BL-054). */
export function McpTrustDialog({
  open,
  onOpenChange,
  serverKey,
  pending,
  onTrustOnce,
  onTrustAlways,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="mcp-trust-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Allow this connection to run a local tool?</DialogTitle>
          <DialogDescription>
            Flows will start this MCP server to pull and publish. The server
            owns its own sign-in. Always allow is listed under Settings and can
            be revoked.
          </DialogDescription>
        </DialogHeader>
        <TechnicalChecks data-testid="mcp-trust-technical">
          <p className="text-muted-foreground">Command</p>
          <p
            className={`${mono} rounded-lg border bg-muted/40 p-3 break-all`}
            data-testid="mcp-trust-key"
          >
            {serverKey}
          </p>
        </TechnicalChecks>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            variant="outline"
            data-testid="mcp-trust-cancel"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            data-testid="mcp-trust-always"
            disabled={pending}
            onClick={onTrustAlways}
          >
            Always allow
          </Button>
          <Button
            data-testid="mcp-trust-once"
            disabled={pending}
            onClick={onTrustOnce}
          >
            Allow and connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
