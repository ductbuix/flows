import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { ShieldCheck } from "lucide-react"
import { Confirmation } from "@/components/ai-elements/confirmation"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverKey: string
  pending?: boolean
  onTrustOnce: () => void
  onTrustAlways: () => void
}

/** Allow a local MCP server once or always (DES-026 / BL-054). */
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
      <DialogContent data-testid="mcp-trust-dialog">
        <DialogHeader>
          <DialogTitle>Allow MCP server?</DialogTitle>
          <DialogDescription>
            Flows will run this MCP server to pull and publish. The server owns
            its own sign-in. Always-allow is listed under Settings and can be
            revoked.
          </DialogDescription>
        </DialogHeader>
        <p
          className="rounded-lg border bg-muted/40 p-3 font-mono text-sm break-all"
          data-testid="mcp-trust-key"
        >
          {serverKey}
        </p>
        <div className="flex flex-col gap-2">
          <Confirmation
            data-testid="mcp-trust-confirmation"
            icon={<ShieldCheck />}
            title="Allow this MCP server?"
            description="Deny cancels. Approve allows once for this session."
            approveLabel="Allow once"
            denyLabel="Cancel"
            approveTestId="mcp-trust-once"
            denyTestId="mcp-trust-cancel"
            pending={pending}
            onApprove={onTrustOnce}
            onDeny={() => onOpenChange(false)}
          />
          <Button
            data-testid="mcp-trust-always"
            disabled={pending}
            onClick={onTrustAlways}
          >
            Always allow
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
