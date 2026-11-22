import type {
  ConnectionDetail,
  LibraryEntity,
  PublishPolicy,
  RefreshRule,
} from "@workspace/shared"
import { McpTrustDialog } from "@/components/McpTrustDialog"
import { PageTitle } from "@/components/page"
import { PublishPolicyBadge } from "@/components/data/PublishPolicyBadge"
import { ConnectionLocalData } from "./ConnectionLocalData"
import { ConnectionPolicyField } from "./ConnectionPolicyField"
import { ConnectionRefreshField } from "./ConnectionRefreshField"
import { ConnectionSignInSection } from "./ConnectionSignInSection"
import { ConnectionUsedBy } from "./ConnectionUsedBy"
import type { useConnectionSignIn } from "./useConnectionSignIn"

type SignIn = ReturnType<typeof useConnectionSignIn>

type Props = {
  detail: ConnectionDetail
  localData: LibraryEntity[]
  saving: boolean
  signIn: SignIn
  mcpKey: string | null
  onSaveRefresh: (refresh: RefreshRule) => void
  onSavePolicy: (policy: PublishPolicy) => void
}

export function ConnectionPageBody({
  detail,
  localData,
  saving,
  signIn,
  mcpKey,
  onSaveRefresh,
  onSavePolicy,
}: Props) {
  return (
    <>
      <PageTitle
        title={detail.name}
        description={`${detail.connector} · ${detail.id}`}
        badge={
          <PublishPolicyBadge
            policy={detail.policy}
            data-testid="connection-policy"
          />
        }
      />
      <ConnectionSignInSection
        conn={detail}
        signedIn={signIn.signedIn}
        check={signIn.check}
        busy={signIn.busy}
        mcpAlwaysAllowed={signIn.mcpAlwaysAllowed}
        onSignIn={() => void signIn.signInWithBrowser()}
        onCheck={() => void signIn.checkAgain()}
        onRemoveSignIn={() => void signIn.removeSignIn()}
        onAllowMcp={() => signIn.setMcpDialogOpen(true)}
        onRevokeMcp={() => {
          if (mcpKey) void signIn.revokeMcp(mcpKey, detail.scope)
        }}
      />
      {mcpKey ? (
        <McpTrustDialog
          open={signIn.mcpDialogOpen}
          onOpenChange={signIn.setMcpDialogOpen}
          serverKey={mcpKey}
          pending={signIn.busy === "mcp"}
          onTrustOnce={() => {
            void signIn.grantMcp(mcpKey, "once", detail.scope)
          }}
          onTrustAlways={() => {
            void signIn.grantMcp(mcpKey, "always", detail.scope)
          }}
        />
      ) : null}
      <ConnectionLocalData entities={localData} />
      <ConnectionUsedBy
        workflows={detail.usedByWorkflows}
        runs={detail.usedByRuns}
      />
      <ConnectionRefreshField
        value={detail.refresh}
        disabled={saving}
        onChange={onSaveRefresh}
      />
      <ConnectionPolicyField
        value={detail.policy}
        disabled={saving}
        onChange={onSavePolicy}
      />
    </>
  )
}
