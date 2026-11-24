import { useState } from "react"
import { MoreHorizontal, SquareKanban, Trash2 } from "lucide-react"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import { Button } from "@workspace/ui/components/button"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { errorMessage, isConflictError } from "@/lib/fcp-error"
import { InlineText } from "@/pages/mock/InlineText"
import { formatDate } from "./format-date"

type Props = {
  cardId: string | null
  onClose: () => void
  onDeleted: () => void
}

export function CardPanel({ cardId, onClose, onDeleted }: Props) {
  return (
    <Sheet open={cardId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-xl"
        data-testid="docket-panel"
      >
        {cardId ? (
          <CardPanelBody key={cardId} cardId={cardId} onDeleted={onDeleted} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function CardPanelBody({
  cardId,
  onDeleted,
}: {
  cardId: string
  onDeleted: () => void
}) {
  const client = useFlowsClient()
  const { data, error, loading } = useQuery(
    "docket/get_card",
    { id: cardId },
    { topics: ["docket"] }
  )
  const [confirming, setConfirming] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function patch(next: { title?: string; body?: string }) {
    if (!data) return
    setSaveError(null)
    setConflict(false)
    try {
      await client.call("docket/update_card", {
        id: cardId,
        baseHash: data.hash,
        patch: next,
      })
    } catch (err) {
      if (isConflictError(err)) setConflict(true)
      else setSaveError(errorMessage(err))
    }
  }

  async function remove() {
    await client.call("docket/delete_card", { id: cardId })
    onDeleted()
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Could not load card</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return (
    <>
      <SheetHeader>
        <div className="flex items-center justify-between pr-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <SquareKanban className="size-4" />
            Card
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Card actions" />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                data-testid="docket-delete"
                onClick={() => setConfirming(true)}
              >
                <Trash2 />
                Delete card
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <SheetTitle className="sr-only">{data.title}</SheetTitle>
        <InlineText
          label="title"
          placeholder="Untitled"
          className="font-heading text-xl font-medium"
          value={data.title}
          onSave={(v) => void patch({ title: v })}
        />
        <SheetDescription>
          {data.id}
          {data.due ? ` · Due ${formatDate(data.due)}` : null}
        </SheetDescription>
      </SheetHeader>
      {(conflict || saveError) && (
        <Alert
          variant="destructive"
          className="mx-4"
          data-testid="docket-conflict"
        >
          <AlertTitle>{conflict ? "Conflict" : "Could not save"}</AlertTitle>
          <AlertDescription>
            {conflict
              ? "This card changed on disk. Close and reopen to reload."
              : saveError}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-4 overflow-y-auto border-t p-4">
        <InlineText
          multiline
          label="description"
          placeholder="Add a description"
          value={data.body}
          onSave={(v) => void patch({ body: v })}
        />
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this card?"
        description="The card and its owned assets are removed. Linked files stay where they are."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirming(false)
          void remove()
        }}
      />
    </>
  )
}
