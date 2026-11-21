import type { ConnectionCheckResult, SignInMethod } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Section } from "@/components/Section"

type Props = {
  signIn: SignInMethod
  check: ConnectionCheckResult | null
  checking: boolean
  onCheck: () => void
}

export function ConnectionSignIn({ signIn, check, checking, onCheck }: Props) {
  return (
    <Section title="Sign-in">
      <div
        className="flex flex-wrap items-center gap-3"
        data-testid="connection-signin"
      >
        <span className="text-sm">
          Method: <span className="font-mono">{signIn}</span>
        </span>
        <span
          className={
            check?.ok === false ? "text-sm text-destructive" : "text-sm"
          }
          data-testid="connection-signin-status"
        >
          {check
            ? check.ok
              ? check.ambientLogin
                ? `Signed in as ${check.ambientLogin}`
                : check.message
              : check.message
            : "Checking…"}
        </span>
        <Button
          size="sm"
          variant="outline"
          data-testid="connection-check"
          disabled={checking}
          onClick={onCheck}
        >
          Check again
        </Button>
      </div>
    </Section>
  )
}
