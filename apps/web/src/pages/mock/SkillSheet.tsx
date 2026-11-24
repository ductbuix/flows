import { Link } from "react-router"
import { Bot } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { mono } from "@/components/data/mono"
import { StatusPill } from "@/components/brand/StatusPill"
import { useLibrary } from "./library-store"
import { statusOf, type Pick } from "./SkillsTable"
import { useSkillUses } from "./skill-usage"
import {
  installSkill,
  readers,
  skillsOf,
  uninstallSkill,
  useSkills,
} from "./skills-store"

/** One skill: where it lives, who reads it, its SKILL.md, and install or update. */
export function SkillSheet({
  pick,
  onClose,
}: {
  pick: Pick | null
  onClose: () => void
}) {
  const skills = useSkills()
  const uses = useSkillUses(pick?.slug ?? "")
  const items = useLibrary()
  const installed = pick
    ? skills.find(
        (s) =>
          s.slug === pick.slug &&
          (pick.scope ? s.scope === pick.scope : s.scope === "workspace")
      )
    : undefined
  const src = pick?.sourceId
    ? skillsOf(pick.sourceId).find((s) => s.slug === pick.slug)
    : undefined
  const sourceId = pick?.sourceId ?? installed?.from?.sourceId
  const item = items.find((i) => i.id === sourceId)
  const body = installed?.body ?? src?.body ?? ""
  const description = installed?.description ?? src?.description
  const r = installed ? readers(installed, skills) : null
  const st = installed ? statusOf(installed, items) : null
  const stale = installed?.from && item && item.current > installed.from.version

  return (
    <Sheet open={!!pick} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-lg"
        data-testid="skill-sheet"
      >
        {pick ? (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle>{pick.slug}</SheetTitle>
              <SheetDescription>
                {description || "No description"}
              </SheetDescription>
            </SheetHeader>
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
                        onClick={() =>
                          item &&
                          installSkill(item.id, installed.slug, item.current)
                        }
                        data-testid="skill-update"
                      >
                        Update to v{item?.current}
                      </Button>
                    ) : null}
                    {installed.from ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          uninstallSkill(installed.slug)
                          onClose()
                        }}
                        data-testid="skill-uninstall"
                      >
                        Uninstall
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{r?.note}</p>
                  {installed.from ? (
                    <p className="text-xs text-muted-foreground">
                      This is a copy. Source updates change it only when you
                      update.
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    From {item?.title} v{item?.current}
                  </span>
                  <Button
                    onClick={() =>
                      item && installSkill(item.id, pick.slug, item.current)
                    }
                    data-testid="skill-install"
                  >
                    Install
                  </Button>
                </div>
              )}
              {!installed ? (
                <p className="text-xs text-muted-foreground">
                  Copies into <span className={mono}>.agents/skills</span> and{" "}
                  <span className={mono}>.claude/skills</span> of the workspace.
                </p>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <h3 className="pb-2 text-sm font-medium text-muted-foreground">
                Used by steps ({uses.length})
              </h3>
              <div className="flex flex-col pb-4" data-testid="skill-used-by">
                {uses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No step uses it yet. Pick it in an agent step's settings.
                  </p>
                ) : null}
                {uses.map((u) => (
                  <Link
                    key={`${u.workflowId}-${u.node}`}
                    to={`/mock/workflows/${u.workflowId}`}
                    className="-mx-2 flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted"
                  >
                    <Bot className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{u.step}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {u.workflow}
                    </span>
                  </Link>
                ))}
              </div>
              <h3 className="pb-2 text-sm font-medium text-muted-foreground">
                SKILL.md
              </h3>
              <pre
                className={`${mono} rounded-xl p-3 text-xs whitespace-pre-wrap ring-1 ring-foreground/10`}
              >
                {body}
              </pre>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
