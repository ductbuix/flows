import { useState } from "react"
import type { LibItem, WireSkillSummary } from "@workspace/contracts"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { mono } from "@/components/data/mono"
import { errorMessage } from "@/lib/fcp-error"
import { readers } from "./readers"
import { installSkill, uninstallSkill, updateSkill } from "./skill-actions"
import { SkillStatusCard, SkillUsedBy } from "./SkillSheetParts"
import { useSkillUses } from "./skill-usage"
import type { AvailableRow, SkillPick } from "./SkillsTable"

export function SkillSheet({
  pick,
  skills,
  items,
  available,
  onClose,
  onConflict,
  onError,
}: {
  pick: SkillPick | null
  skills: WireSkillSummary[]
  items: LibItem[]
  available: AvailableRow[]
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
            items={items}
            available={available}
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
  items,
  available,
  onClose,
  onConflict,
  onError,
}: {
  pick: SkillPick
  skills: WireSkillSummary[]
  items: LibItem[]
  available: AvailableRow[]
  onClose: () => void
  onConflict: () => void
  onError: (message: string) => void
}) {
  const client = useFlowsClient()
  const uses = useSkillUses(pick.slug)
  const installed = skills.find(
    (s) =>
      s.slug === pick.slug &&
      (pick.scope ? s.scope === pick.scope : s.scope === "workspace")
  )
  const offer = pick.sourceId
    ? available.find(
        (a) => a.slug === pick.slug && a.sourceId === pick.sourceId
      )
    : available.find((a) => a.slug === pick.slug)
  const sourceId = pick.sourceId ?? installed?.from?.sourceId
  const item = items.find((i) => i.id === sourceId)
  const scope = pick.scope ?? installed?.scope ?? "workspace"
  const detailQ = useQuery(
    "skill/get",
    { slug: pick.slug, scope },
    { topics: ["skill"] }
  )
  const [busy, setBusy] = useState(false)
  const detail = installed ? detailQ.data : undefined
  const r = installed ? readers(installed, skills) : null
  const body = detail?.body ?? offer?.body ?? ""
  const description =
    detail?.description ?? installed?.description ?? offer?.description
  const stale =
    !!installed?.from && !!item && item.current > installed.from.version

  async function run(
    action: () => Promise<"ok" | "conflict" | string>,
    closeOnOk = false
  ) {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (result === "conflict") onConflict()
    else if (result !== "ok") onError(result)
    else if (closeOnOk) onClose()
  }

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle>{pick.slug}</SheetTitle>
        <SheetDescription>{description || "No description"}</SheetDescription>
      </SheetHeader>
      <SkillStatusCard
        installed={installed}
        item={item}
        note={r?.note}
        stale={stale}
        busy={busy}
        sourceLabel={item?.title ?? sourceId ?? ""}
        version={item?.current}
        showInstall={!installed}
        onUpdate={() =>
          void run(() =>
            updateSkill(client, {
              sourceId: installed!.from!.sourceId,
              slug: installed!.slug,
              version: item!.current,
            })
          )
        }
        onUninstall={() =>
          void run(() => uninstallSkill(client, installed!.slug), true)
        }
        onInstall={() =>
          void run(() =>
            installSkill(client, {
              sourceId: sourceId!,
              slug: pick.slug,
              version: item!.current,
            })
          )
        }
      />
      {installed && detailQ.loading && !detail ? (
        <div
          className="flex flex-col gap-2 px-4"
          data-testid="skill-sheet-loading"
        >
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}
      {installed && detailQ.error && !detail ? (
        <Alert
          variant="destructive"
          className="mx-4"
          data-testid="skill-sheet-error"
        >
          <AlertTitle>Could not load skill</AlertTitle>
          <AlertDescription>{errorMessage(detailQ.error)}</AlertDescription>
        </Alert>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <SkillUsedBy uses={uses} />
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
