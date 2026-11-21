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

export function ConnectionSignInSection({
  conn,
  signedIn,
  check,
  busy,
  onSignIn,
  onCheck,
  onRemoveSignIn,
}: Props) {
  return (
    <Section title="Sign-in">
      <div className="flex max-w-xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            data-testid="connection-sign-in-status"
            variant={signedIn ? "secondary" : "outline"}
          >
            {signedIn ? "Signed in" : "Signed out"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Method: {conn.signIn}
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
          {conn.signIn === "cookies" ? (
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
          {conn.signIn === "cookies" ? (
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
        <p className="text-sm text-muted-foreground">
          Browser sign-in opens Chrome with a Flows-owned profile. Cookies stay
          under secrets/ and tasks cannot read them.
        </p>
      </div>
    </Section>
  )
}
