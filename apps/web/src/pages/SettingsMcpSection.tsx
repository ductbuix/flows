import type { McpTrustEntry } from "@workspace/shared"
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
import { Section } from "@/components/Section"

type Props = {
  servers: McpTrustEntry[] | null
  revokingKey: string | null
  onRevoke: (key: string) => void
}

/** Allowed MCP servers list and revoke (DES-026 / BL-054). */
export function SettingsMcpSection({ servers, revokingKey, onRevoke }: Props) {
  return (
    <Section title="Allowed MCP servers">
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
                <ItemTitle className="font-mono break-all">
                  {server.key}
                </ItemTitle>
                <ItemDescription>
                  Allowed {new Date(server.trustedAt).toLocaleString()}
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
    </Section>
  )
}
