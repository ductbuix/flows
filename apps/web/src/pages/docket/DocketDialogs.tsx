import type { Board, BoardColumn } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { isConflictError } from "@/lib/fcp-error"
import { ensureBoard } from "./board-actions"
import { CardPanel } from "./CardPanel"
import { ColumnsDialog } from "./ColumnsDialog"
import { NewCardDialog, type NewCardInput } from "./NewCardDialog"

type Props = {
  client: FlowsClient
  board: Board
  boardHash: string
  columns: BoardColumn[]
  cardStatuses: string[]
  cardIds: string[]
  editingCols: boolean
  creating: string | null
  openId: string | null
  defaultStatus: string
  onEditingCols: (open: boolean) => void
  onCreating: (col: string | null) => void
  onOpenId: (id: string | null) => void
  onConflict: () => void
  onClearErrors: () => void
}

export function DocketDialogs({
  client,
  board,
  boardHash,
  columns,
  cardStatuses,
  cardIds,
  editingCols,
  creating,
  openId,
  defaultStatus,
  onEditingCols,
  onCreating,
  onOpenId,
  onConflict,
  onClearErrors,
}: Props) {
  async function saveBoard(next: Board, migrateStatus?: string) {
    onClearErrors()
    try {
      await client.call("docket/save_board", {
        baseHash: boardHash,
        board: next,
        migrateStatus,
      })
    } catch (err) {
      if (isConflictError(err)) {
        onConflict()
        throw new Error("Board changed on disk. Reload and try again.", {
          cause: err,
        })
      }
      throw err
    }
  }

  async function createCard(input: NewCardInput) {
    onClearErrors()
    await ensureBoard(client, board, boardHash)
    await client.call("docket/create_card", {
      id: input.id,
      title: input.title,
      status: input.status,
      body: input.body,
      refs: input.refs?.filter((r): r is NonNullable<typeof r> => r != null),
    })
    onOpenId(input.id)
  }

  return (
    <>
      <ColumnsDialog
        open={editingCols}
        board={board}
        cardStatuses={cardStatuses}
        onOpenChange={onEditingCols}
        onSave={saveBoard}
      />
      <NewCardDialog
        open={creating !== null}
        defaultStatus={defaultStatus}
        columns={columns}
        existingIds={cardIds}
        onOpenChange={(o) => !o && onCreating(null)}
        onCreate={createCard}
      />
      <CardPanel
        cardId={openId}
        onClose={() => onOpenId(null)}
        onDeleted={() => onOpenId(null)}
      />
    </>
  )
}
