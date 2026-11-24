import type { ConnectorFile } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Switch } from "@workspace/ui/components/switch"
import { mono } from "@/components/data/mono"

export function ConnectorAccessTab({
  capabilities,
  busy,
  onToggle,
}: {
  capabilities: ConnectorFile["capabilities"]
  busy: boolean
  onToggle: (name: string, allowed: boolean) => void
}) {
  return (
    <>
      <p className="pb-2 text-sm text-muted-foreground">
        What agents and scripts may do here. Writing is off until you allow it.
      </p>
      {capabilities.map((x) => (
        <div
          key={x.name}
          className="flex min-h-12 items-center gap-3 rounded-lg px-2 hover:bg-muted"
          data-testid={`capability-${x.name}`}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2 text-sm">
              <span className={mono}>{x.name}</span>
              {x.write ? <Badge variant="secondary">Writes</Badge> : null}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {x.desc}
            </span>
          </div>
          <Switch
            checked={x.allowed}
            disabled={busy}
            onCheckedChange={(v) => onToggle(x.name, v)}
            aria-label={`Allow ${x.name}`}
          />
        </div>
      ))}
    </>
  )
}
