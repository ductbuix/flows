import { useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { Columns3, Inbox, Plus } from "lucide-react"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { Page, PageTitle } from "@/components/page"
import { errorMessage } from "@/lib/fcp-error"
import { ensureBoard, moveCard, rankCards } from "./board-actions"
import { BoardLanes } from "./BoardLanes"
import { toUiColumns } from "./column-tone"
import { DocketDialogs } from "./DocketDialogs"
import { DocketLoadError, DocketLoading, DocketNoBoard } from "./DocketStates"

export function DocketPage() {
  return (
    <FlowsClientGate>
      <DocketPageInner />
    </FlowsClientGate>
  )
}

function DocketPageInner() {
  const client = useFlowsClient()
  const boardQ = useQuery("docket/get_board", {}, { topics: ["docket"] })
  const cardsQ = useQuery("docket/list_cards", {}, { topics: ["docket"] })
  const [params] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(params.get("card"))
  const [editingCols, setEditingCols] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [overCard, setOverCard] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)

  const board = boardQ.data?.board ?? null
  const boardHash = boardQ.data?.hash ?? ""
  const cards = useMemo(
    () => rankCards(cardsQ.data?.items ?? []),
    [cardsQ.data?.items]
  )
  const columns = useMemo(
    () => (board ? toUiColumns(board.columns) : []),
    [board]
  )
  const loading =
    (boardQ.loading && !boardQ.data) || (cardsQ.loading && !cardsQ.data)
  const loadError = boardQ.error ?? cardsQ.error

  function endDrag() {
    setDragId(null)
    setOverCol(null)
    setOverCard(null)
  }

  async function onMove(status: string, beforeId: string | null) {
    if (!dragId || dragId === beforeId) return
    setActionError(null)
    setConflict(false)
    const result = await moveCard(client, cards, dragId, status, beforeId)
    if (result === "conflict") setConflict(true)
    else if (result !== "ok") setActionError(result)
  }

  if (loading) return <DocketLoading />
  if (loadError) return <DocketLoadError error={loadError} />
  if (!board) {
    return (
      <DocketNoBoard
        actionError={actionError}
        onCreate={() =>
          void ensureBoard(client, board, boardHash).catch((err) =>
            setActionError(errorMessage(err))
          )
        }
      />
    )
  }

  return (
    <Page
      fill
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Docket" }]}
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setEditingCols(true)}
            data-testid="docket-columns-open"
          >
            <Columns3 />
            Columns
          </Button>
          <Button
            onClick={() => setCreating(columns[0]?.id ?? null)}
            data-testid="docket-new-card-open"
          >
            <Plus />
            New card
          </Button>
        </div>
      }
      data-testid="docket-page"
    >
      <PageTitle
        title="Docket"
        description="Cards wrap tickets, files and notes."
      />
      {(conflict || actionError) && (
        <Alert variant="destructive" data-testid="docket-conflict">
          <AlertTitle>{conflict ? "Conflict" : "Could not update"}</AlertTitle>
          <AlertDescription>
            {conflict
              ? "A card changed while you were editing. The board reloads from disk."
              : actionError}
          </AlertDescription>
        </Alert>
      )}
      {cards.length === 0 ? (
        <Empty className="mb-4" data-testid="docket-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No cards</EmptyTitle>
            <EmptyDescription>Create a card to get started.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      <BoardLanes
        columns={columns}
        cards={cards}
        dragId={dragId}
        overCol={overCol}
        overCard={overCard}
        onOpen={setOpenId}
        onDragStart={setDragId}
        onDragEnd={endDrag}
        onOverCol={(id) => {
          setOverCol(id)
          setOverCard(null)
        }}
        onOverCard={(colId, cardId) => {
          setOverCol(colId)
          setOverCard(cardId)
        }}
        onDropCol={(colId) => {
          void onMove(colId, null).finally(endDrag)
        }}
        onDropCard={(colId, beforeId) => {
          void onMove(colId, beforeId).finally(endDrag)
        }}
        onAdd={setCreating}
      />
      <DocketDialogs
        client={client}
        board={board}
        boardHash={boardHash}
        columns={board.columns}
        cardStatuses={cards.map((c) => c.status)}
        cardIds={cards.map((c) => c.id)}
        editingCols={editingCols}
        creating={creating}
        openId={openId}
        defaultStatus={creating ?? columns[0]?.id ?? ""}
        onEditingCols={setEditingCols}
        onCreating={setCreating}
        onOpenId={setOpenId}
        onConflict={() => setConflict(true)}
        onClearErrors={() => {
          setConflict(false)
          setActionError(null)
        }}
      />
    </Page>
  )
}
