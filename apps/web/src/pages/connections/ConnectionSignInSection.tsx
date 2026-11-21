import type { Connection, ConnectionCheckResult } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Section } from "@/components/Section"

type Busy = "sign-in" | "remove" | "check" | "mcp" | null

type Props = {
  conn: Connection
  signedIn: boolean
  check: ConnectionCheckResult | null
  busy: Busy
  mcpAlwaysAllowed: boolean
  onSignIn: () => void
  onCheck: () => void
  onRemoveSignIn: () => void
  onAllowMcp: () => void
  onRevokeMcp: () => void
}

function mcpServerKey(conn: Connection): string | null {
  const command = conn.scope.command?.trim()
  if (command) return command
  const url = conn.scope.url?.trim()
  if (url) return url
  return null
}

function statusLabel(
  conn: Connection,
  signedIn: boolean,
  check: ConnectionCheckResult | null
): string {
  if (conn.signIn === "cookies") {
    if (!signedIn) return "Signed out"
    if (check && !check.ok) return check.message
    return "Signed in"
  }
  if (!check) return "Checking…"
  if (!check.ok) return check.message
  if (check.ambientLogin) return `Signed in as ${check.ambientLogin}`
  return check.message
}

/** Sign-in status, check, browser / MCP allow (BL-045 / BL-053 / BL-054). */
export function ConnectionSignInSection({
  conn,
  signedIn,
  check,
  busy,
  mcpAlwaysAllowed,
  onSignIn,
  onCheck,
  onRemoveSignIn,
  onAllowMcp,
  onRevokeMcp,
}: Props) {
  const cookies = conn.signIn === "cookies"
  const mcp = conn.signIn === "mcp"
  const serverKey = mcp ? mcpServerKey(conn) : null
  const ok = cookies
    ? signedIn && (check ? check.ok : true)
    : check?.ok === true || (!check && signedIn)

  return (
    <Section title="Sign-in">
      <div
        className="flex max-w-xl flex-col gap-4"
        data-testid="connection-signin"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            data-testid="connection-sign-in-status"
            variant={ok ? "secondary" : "outline"}
          >
            {statusLabel(conn, signedIn, check)}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Method: <span className="font-mono">{conn.signIn}</span>
          </span>
        </div>
        {check ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="connection-check-message"
          >
            {check.message}
          </p>
        ) : null}
        {mcp && serverKey ? (
          <p
            className="font-mono text-sm break-all text-muted-foreground"
            data-testid="connection-mcp-key"
          >
            {serverKey}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {cookies ? (
            <Button
              data-testid="connection-sign-in-browser"
              disabled={busy !== null}
              onClick={onSignIn}
            >
              {busy === "sign-in"
                ? "Waiting for browser…"
                : "Sign in with browser"}
            </Button>
          ) : null}
          {mcp ? (
            mcpAlwaysAllowed ? (
              <Button
                data-testid="connection-mcp-revoke"
                variant="outline"
                disabled={busy !== null}
                onClick={onRevokeMcp}
              >
                Revoke MCP allow
              </Button>
            ) : (
              <Button
                data-testid="connection-mcp-allow"
                disabled={busy !== null || !serverKey}
                onClick={onAllowMcp}
              >
                Allow MCP server
              </Button>
            )
          ) : null}
          <Button
            data-testid="connection-check"
            variant="outline"
            disabled={busy !== null}
            onClick={onCheck}
          >
            Check again
          </Button>
          {cookies ? (
            <Button
              data-testid="connection-remove-sign-in"
              variant="outline"
              disabled={busy !== null || !signedIn}
              onClick={onRemoveSignIn}
            >
              Remove sign-in
            </Button>
          ) : null}
        </div>
        {cookies ? (
          <p className="text-sm text-muted-foreground">
            Browser sign-in opens Chrome with a Flows-owned profile. Cookies
            stay under secrets/ and tasks cannot read them.
          </p>
        ) : null}
        {mcp ? (
          <p className="text-sm text-muted-foreground">
            The MCP server owns its login. Flows stores only its command or URL
            in connection.yaml and runs it after you allow it.
          </p>
        ) : null}
      </div>
    </Section>
  )
}
