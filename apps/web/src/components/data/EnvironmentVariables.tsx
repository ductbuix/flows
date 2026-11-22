/**
 * Project component (no shadcn example). Moved out of ai-elements; uses base-nova Item and Switch.
 */
import { Badge } from "@workspace/ui/components/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Switch } from "@workspace/ui/components/switch"

export type EnvVar = {
  name: string
  value: string
  badge?: string
}

type Props = {
  vars: EnvVar[]
  "data-testid"?: string
}

/**
 * Environment variables as Item + Badge + Switch (AI Elements replacement
 * for environment-variables.tsx). Read-only: Switch shows the var is set.
 */
export function EnvironmentVariables({ vars, "data-testid": testId }: Props) {
  return (
    <ItemGroup data-testid={testId} className="gap-2">
      {vars.map((v) => (
        <Item key={v.name} size="sm" variant="outline">
          <ItemContent>
            <ItemTitle className="font-mono">{v.name}</ItemTitle>
            <ItemDescription className="font-mono">{v.value}</ItemDescription>
          </ItemContent>
          <ItemActions>
            {v.badge ? <Badge variant="secondary">{v.badge}</Badge> : null}
            <Switch checked disabled aria-label={`${v.name} set`} />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}
