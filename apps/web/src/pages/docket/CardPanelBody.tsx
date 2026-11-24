import { useState } from "react"
import type { DocketRef } from "@workspace/contracts"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { errorMessage, isConflictError } from "@/lib/fcp-error"
import { AssetsSection } from "./AssetsSection"
import { CardPanelHeader } from "./CardPanelHeader"
import { InlineText } from "./InlineText"
import { LinksSection } from "./LinksSection"
import { PropertiesSection, type PropertyPatch } from "./PropertiesSection"
import { RefDataSection } from "./RefDataSection"
import { RefsSection } from "./RefsSection"
import { Section } from "./SectionParts"

type CardPatch = {
  title?: string
  body?: string
  status?: string
  start?: string | null
  due?: string | null
  refs?: DocketRef[]
  links?: { to: string; rel: "relates" | "blocks" | "parent" | "duplicates" }[]
  fields?: Record<string, unknown>
}

export function CardPanelBody({
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
  const boardQ = useQuery("docket/get_board", {}, { topics: ["docket"] })
  const cardsQ = useQuery("docket/list_cards", {}, { topics: ["docket"] })
  const [confirming, setConfirming] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function patch(next: CardPatch) {
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

  const columns = boardQ.data?.board?.columns ?? []
  const allCards = (cardsQ.data?.items ?? []).map((c) => ({
    id: c.id,
    title: c.title,
  }))
  const storedLinks = data.links.map(({ to, rel }) => ({ to, rel }))

  return (
    <>
      <CardPanelHeader
        id={data.id}
        title={data.title}
        due={data.due}
        conflict={conflict}
        saveError={saveError}
        onSaveTitle={(v) => void patch({ title: v })}
        onDelete={() => setConfirming(true)}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto border-t md:grid-cols-3 md:overflow-hidden">
        <div className="flex flex-col gap-4 overflow-y-auto p-4 md:col-span-2 md:border-r">
          <RefsSection
            refs={data.refs}
            onChange={(refs) => void patch({ refs })}
          />
          <PropertiesSection
            status={data.status}
            start={data.start}
            due={data.due}
            fields={data.fields ?? {}}
            columns={columns}
            onChange={(next: PropertyPatch) => void patch(next)}
          />
          <Section title="Description">
            <InlineText
              multiline
              label="description"
              placeholder="Add a description"
              value={data.body}
              onSave={(v) => void patch({ body: v })}
            />
          </Section>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <LinksSection
              cardId={cardId}
              links={storedLinks}
              backlinks={data.backlinks}
              allCards={allCards}
              onChange={(links) => void patch({ links })}
            />
            <AssetsSection
              client={client}
              cardId={cardId}
              baseHash={data.hash}
              assets={data.assets}
              onMutated={() => {
                /* docket/update invalidates via subscription */
              }}
            />
            <div className="border-t pt-4">
              <RefDataSection refs={data.refs} />
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this card?"
        description="The card and its owned assets are removed. Linked files stay where they are."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirming(false)
          void client.call("docket/delete_card", { id: cardId }).then(onDeleted)
        }}
      />
    </>
  )
}
