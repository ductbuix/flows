import { Link } from "react-router"
import { Bot } from "lucide-react"
import type { LibItem, WireSkillSummary } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { StatusPill } from "@/components/brand/StatusPill"
import { mono } from "@/components/data/mono"
import type { SkillUse } from "./skill-usage"
import { statusOf } from "./status"

export function SkillStatusCard({
  installed,
  item,
  note,
  stale,
  busy,
  onUpdate,
  onUninstall,
  onInstall,
  sourceLabel,
  version,
  showInstall,
}: {
  installed?: WireSkillSummary
  item?: LibItem
  note?: string
  stale: boolean
  busy: boolean
  onUpdate: () => void
  onUninstall: () => void
  onInstall: () => void
  sourceLabel: string
  version?: number
  showInstall: boolean
}) {
  const st = installed ? statusOf(installed, item?.current) : null
  return (
    <div className="mx-4 flex flex-col gap-2 rounded-2xl bg-muted/50 p-3 ring-1 ring-foreground/10">
      {installed && st ? (
        <>
          <div className="flex items-center gap-2">
            <StatusPill tone={st.tone}>{st.label}</StatusPill>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {installed.from && item
                ? `From ${item.title} v${installed.from.version}`
                : "Found on disk, never edited by the app"}
            </span>
            {stale ? (
              <Button
                disabled={busy}
                onClick={onUpdate}
                data-testid="skill-update"
              >
                Update to v{item?.current}
              </Button>
            ) : null}
            {installed.from ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={onUninstall}
                data-testid="skill-uninstall"
              >
                Uninstall
              </Button>
            ) : null}
          </div>
          {note ? (
            <p className="text-xs text-muted-foreground">{note}</p>
          ) : null}
          {installed.from ? (
            <p className="text-xs text-muted-foreground">
              This is a copy. Source updates change it only when you update.
            </p>
          ) : null}
        </>
      ) : showInstall ? (
        <>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              From {sourceLabel} v{version}
            </span>
            <Button
              disabled={busy}
              onClick={onInstall}
              data-testid="skill-install"
            >
              Install
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Copies into <span className={mono}>.agents/skills</span> and{" "}
            <span className={mono}>.claude/skills</span> of the workspace.
          </p>
        </>
      ) : null}
    </div>
  )
}

export function SkillUsedBy({ uses }: { uses: SkillUse[] }) {
  return (
    <>
      <h3 className="pb-2 text-sm font-medium text-muted-foreground">
        Used by steps ({uses.length})
      </h3>
      <div className="flex flex-col pb-4" data-testid="skill-used-by">
        {uses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No step uses it yet. Pick it in an agent step&apos;s settings.
          </p>
        ) : null}
        {uses.map((u) => (
          <Link
            key={`${u.workflowId}-${u.node}`}
            to={`/workflows/${u.workflowId}`}
            className="-mx-2 flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted"
            data-testid={`skill-used-${u.workflowId}-${u.node}`}
          >
            <Bot className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{u.step}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {u.workflow}
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
