import type { Connection, ConnectionCheckResult } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Section } from "@/components/Section"

type Busy = "sign-in" | "remove" | "check" | null

type Props = {
  conn: Connection
  signedIn: boolean
  check: ConnectionCheckResult | null
  busy: Busy
  onSignIn: () => void
  onCheck: () => void
  onRemoveSignIn: () => void
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

/** Sign-in status, check, browser sign-in and remove (BL-045 / BL-053). */
export function ConnectionSignInSection({
  conn,
  signedIn,
  check,
  busy,
  onSignIn,
  onCheck,
  onRemoveSignIn,
}: Props) {
  const cookies = conn.signIn === "cookies"
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
      </div>
    </Section>
  )
}
