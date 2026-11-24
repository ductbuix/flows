import { useEffect, useState } from "react"
import { File as FileIcon, HardDriveUpload } from "lucide-react"
import type { FcpCallResult, FlowsClient } from "@workspace/sdk"
import { useQuery } from "@workspace/sdk-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import { errorMessage } from "@/lib/fcp-error"
import { AddAssetDiskDialog } from "./AddAssetDiskDialog"
import { AssetOpenMenu } from "./AssetOpenMenu"
import { AssetRowMenu } from "./AssetRowMenu"
import { Adder, EmptyLine, ListRow, Section } from "./SectionParts"

type IndexedAsset = FcpCallResult<"docket/get_card">["assets"][number]
type LibItem = FcpCallResult<"library/list">["items"][number]

type Props = {
  client: FlowsClient
  cardId: string
  baseHash: string
  assets: IndexedAsset[]
  onMutated: () => void
}

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path
}

/** Owned and linked files on the card (DES-038 / BL-199). */
export function AssetsSection({
  client,
  cardId,
  baseHash,
  assets,
  onMutated,
}: Props) {
  const libQ = useQuery("library/list", {}, { topics: ["library"] })
  const [home, setHome] = useState("")
  const [diskOpen, setDiskOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void client.ready.then((init) => {
      if (alive) setHome(init.workspace.home)
    })
    return () => {
      alive = false
    }
  }, [client])

  const library = libQ.data?.items ?? []
  const linkedPaths = new Set(
    assets.filter((a) => a.scope === "linked").map((a) => a.path)
  )
  const rest = library.filter((i) => {
    if (!home) return true
    return !linkedPaths.has(`${home.replace(/\/$/, "")}/library/${i.id}`)
  })

  async function remove(path: string) {
    setError(null)
    try {
      await client.call("docket/remove_asset", {
        id: cardId,
        path,
        baseHash,
      })
      onMutated()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function linkLibrary(item: LibItem, done: () => void) {
    if (!home) return
    setError(null)
    const path = `${home.replace(/\/$/, "")}/library/${item.id}`
    try {
      await client.call("docket/add_asset", {
        id: cardId,
        scope: "linked",
        path,
        label: item.title,
        baseHash,
      })
      onMutated()
      done()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const assetsRoot = `docket/cards/${cardId}/assets`

  return (
    <Section title="Assets">
      {assets.length ? (
        assets.map((a) => (
          <ListRow key={a.path}>
            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              {a.label ?? basename(a.path)}
            </span>
            <Badge variant="secondary" className="shrink-0">
              {a.scope}
            </Badge>
            {a.missing ? (
              <Badge variant="destructive" className="shrink-0">
                Missing
              </Badge>
            ) : null}
            <AssetRowMenu
              label={a.label ?? basename(a.path)}
              onRemove={() => void remove(a.path)}
            />
          </ListRow>
        ))
      ) : (
        <EmptyLine>No assets yet</EmptyLine>
      )}
      <Adder label="Add asset">
        {(done) => (
          <Combobox
            defaultOpen
            items={rest}
            value={null}
            onValueChange={(i: LibItem | null) => {
              if (!i) return
              void linkLibrary(i, done)
            }}
            itemToStringLabel={(i: LibItem) => i.title}
            itemToStringValue={(i: LibItem) => i.id}
          >
            <ComboboxInput
              autoFocus
              aria-label="Asset from the Library"
              placeholder="Search the Library"
              data-testid="asset-picker"
              className="w-full"
            />
            <ComboboxContent align="end" className="w-80">
              <ComboboxEmpty>Nothing else in the Library</ComboboxEmpty>
              <ComboboxList>
                {(i: LibItem) => (
                  <ComboboxItem key={i.id} value={i}>
                    <span className="min-w-0 flex-1 truncate">{i.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {i.kind}
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxList>
              <div className="border-t p-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setDiskOpen(true)
                    done()
                  }}
                  data-testid="asset-add-from-disk"
                >
                  <HardDriveUpload />
                  Add from disk…
                </Button>
              </div>
            </ComboboxContent>
          </Combobox>
        )}
      </Adder>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {home ? (
        <AssetOpenMenu client={client} storePath={assetsRoot} home={home} />
      ) : null}
      <AddAssetDiskDialog
        open={diskOpen}
        onOpenChange={setDiskOpen}
        client={client}
        cardId={cardId}
        baseHash={baseHash}
        onAdded={onMutated}
      />
    </Section>
  )
}
