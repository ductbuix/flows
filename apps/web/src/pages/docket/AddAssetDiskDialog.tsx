import { useState } from "react"
import type { FlowsClient } from "@workspace/sdk"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { DiskPickerBoth, type DiskPick } from "@/components/disk-picker"
import { errorMessage } from "@/lib/fcp-error"
import { uploadBlob } from "@/lib/upload-blob"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: FlowsClient
  cardId: string
  baseHash: string
  onAdded: () => void
}

/** Pick a file from disk, upload as a blob, then docket/add_asset (owned). */
export function AddAssetDiskDialog({
  open,
  onOpenChange,
  client,
  cardId,
  baseHash,
  onAdded,
}: Props) {
  const [pick, setPick] = useState<DiskPick | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close(next: boolean) {
    if (!next) {
      setPick(null)
      setError(null)
      setBusy(false)
    }
    onOpenChange(next)
  }

  async function submit() {
    if (!pick || pick.entries.length === 0) return
    setBusy(true)
    setError(null)
    try {
      let hash = baseHash
      const scope = `docket/cards/${cardId}/assets`
      for (const { file } of pick.entries) {
        const ref = await uploadBlob(client, {
          scope,
          name: file.name,
          body: file,
          mime: file.type || "application/octet-stream",
        })
        const result = await client.call("docket/add_asset", {
          id: cardId,
          scope: "owned",
          blobId: ref.id,
          name: file.name,
          label: pick.folder ? `${pick.label}/${file.name}` : undefined,
          baseHash: hash,
        })
        hash = result.hash
      }
      onAdded()
      close(false)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-testid="asset-disk-dialog">
        <DialogHeader>
          <DialogTitle>Add asset from disk</DialogTitle>
          <DialogDescription>
            Files are copied into this card’s assets folder. The originals stay
            where they are.
          </DialogDescription>
        </DialogHeader>
        <DiskPickerBoth
          value={pick}
          onPick={setPick}
          chosenNote="copied into the card assets folder"
          emptyHint="Nothing chosen. Files are copied into the card; the originals stay where they are."
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => close(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            disabled={!pick || busy}
            data-testid="asset-disk-submit"
            onClick={() => void submit()}
          >
            {busy ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
