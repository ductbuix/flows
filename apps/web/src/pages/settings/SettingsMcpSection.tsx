import type { McpTrustEntry } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { FieldDescription } from "@workspace/ui/components/field"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { RelativeTime } from "@/components/data/RelativeTime"
import { mono } from "@/components/data/mono"
import { PageSection } from "@/components/page"

type Props = {
  servers: McpTrustEntry[] | null
  revokingKey: string | null
  onRevoke: (key: string) => void
}

/** Allowed MCP servers list and revoke (DES-026 / BL-210). */
export function SettingsMcpSection({ servers, revokingKey, onRevoke }: Props) {
  return (
    <PageSection title="Allowed MCP servers">
      <FieldDescription>
        Local MCP servers (command or URL) run only after you allow them. Revoke
        here to require allow again.
      </FieldDescription>
      {!servers ? (
        <Skeleton className="h-20 w-full" />
      ) : servers.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="mcp-trust-empty"
        >
          No MCP servers allowed yet.
        </p>
      ) : (
        <ItemGroup data-testid="mcp-trust-list">
          {servers.map((server) => (
            <Item
              key={server.key}
              variant="outline"
              data-testid="mcp-trust-row"
            >
              <ItemContent>
                <ItemTitle className={`${mono} break-all`}>
                  {server.key}
                </ItemTitle>
                <ItemDescription>
                  Allowed <RelativeTime value={server.trustedAt} />
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="mcp-trust-revoke"
                  disabled={revokingKey === server.key}
                  onClick={() => onRevoke(server.key)}
                >
                  Revoke
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </PageSection>
  )
}
