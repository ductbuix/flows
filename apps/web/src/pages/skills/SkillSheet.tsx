import { useState } from "react"
import type { WireSkillSummary } from "@workspace/contracts"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { StatusPill } from "@/components/brand/StatusPill"
import { mono } from "@/components/data/mono"
import { errorMessage } from "@/lib/fcp-error"
import { readers } from "./readers"
import { uninstallSkill } from "./skill-actions"
import type { SkillPick } from "./SkillsTable"
import { statusOf } from "./status"

export function SkillSheet({
  pick,
  skills,
  onClose,
  onConflict,
  onError,
}: {
  pick: SkillPick | null
  skills: WireSkillSummary[]
  onClose: () => void
  onConflict: () => void
  onError: (message: string) => void
}) {
  return (
    <Sheet open={!!pick} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-lg"
        data-testid="skill-sheet"
      >
        {pick ? (
          <SkillSheetBody
            pick={pick}
            skills={skills}
            onClose={onClose}
            onConflict={onConflict}
            onError={onError}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function SkillSheetBody({
  pick,
  skills,
  onClose,
  onConflict,
  onError,
}: {
  pick: SkillPick
  skills: WireSkillSummary[]
  onClose: () => void
  onConflict: () => void
  onError: (message: string) => void
}) {
  const client = useFlowsClient()
  const detailQ = useQuery(
    "skill/get",
    { slug: pick.slug, scope: pick.scope },
    { topics: ["skill"] }
  )
  const [busy, setBusy] = useState(false)
  const installed = skills.find(
    (s) => s.slug === pick.slug && s.scope === pick.scope
  )
  const detail = detailQ.data
  const r = installed ? readers(installed, skills) : null
  const st = installed ? statusOf(installed) : null
  const body = detail?.body ?? ""
  const description = detail?.description ?? installed?.description

  async function onUninstall() {
    if (!installed?.from) return
    setBusy(true)
    const result = await uninstallSkill(client, installed.slug)
    setBusy(false)
    if (result === "conflict") onConflict()
    else if (result !== "ok") onError(result)
    else onClose()
  }

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle>{pick.slug}</SheetTitle>
        <SheetDescription>{description || "No description"}</SheetDescription>
      </SheetHeader>
      {detailQ.loading && !detail ? (
        <div
          className="flex flex-col gap-2 px-4"
          data-testid="skill-sheet-loading"
        >
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}
      {detailQ.error && !detail ? (
        <Alert
          variant="destructive"
          className="mx-4"
          data-testid="skill-sheet-error"
        >
          <AlertTitle>Could not load skill</AlertTitle>
          <AlertDescription>{errorMessage(detailQ.error)}</AlertDescription>
        </Alert>
      ) : null}
      {installed && st ? (
        <div className="mx-4 flex flex-col gap-2 rounded-2xl bg-muted/50 p-3 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2">
            <StatusPill tone={st.tone}>{st.label}</StatusPill>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {installed.from
                ? `From ${installed.from.sourceId} v${installed.from.version}`
                : "Found on disk, never edited by the app"}
            </span>
            {installed.from ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void onUninstall()}
                data-testid="skill-uninstall"
              >
                Uninstall
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{r?.note}</p>
          {installed.from ? (
            <p className="text-xs text-muted-foreground">
              This is a copy. Source updates change it only when you update.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <h3 className="pb-2 text-sm font-medium text-muted-foreground">
          SKILL.md
        </h3>
        <pre
          className={`${mono} rounded-xl p-3 text-xs whitespace-pre-wrap ring-1 ring-foreground/10`}
          data-testid="skill-body"
        >
          {body}
        </pre>
      </div>
    </>
  )
}
