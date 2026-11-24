import { useState } from "react"
import type { LibItem, ProviderDescriptor } from "@workspace/contracts"
import { useFlowsClient } from "@workspace/sdk-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { DiskPickerBoth, type DiskPick } from "@/components/disk-picker"
import { addFromDisk, addFromLink } from "./library-actions"
import {
  DetectCard,
  findExisting,
  LinkInput,
  matchLink,
} from "./ProviderDetect"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: readonly LibItem[]
  providers: readonly ProviderDescriptor[]
  onAdded: (id: string) => void
  onOpenExisting?: (id: string) => void
  onError: (message: string) => void
}

/** Add by link (then fetch) or copy from disk. Every item becomes a folder. */
export function AddLibraryDialog({
  open,
  onOpenChange,
  items,
  providers,
  onAdded,
  onOpenExisting,
  onError,
}: Props) {
  const client = useFlowsClient()
  const [url, setUrl] = useState("")
  const [pick, setPick] = useState<DiskPick | null>(null)
  const [title, setTitle] = useState("")
  const [tags, setTags] = useState("")
  const [busy, setBusy] = useState(false)
  const match = matchLink(url, providers)
  const existing = findExisting(match, items)

  function close(next: boolean) {
    if (!next) {
      setUrl("")
      setTitle("")
      setTags("")
      setPick(null)
      setBusy(false)
    }
    onOpenChange(next)
  }

  async function submitLink() {
    if (!match || existing) return
    setBusy(true)
    const result = await addFromLink(client, match.url)
    setBusy(false)
    if (!result.ok) {
      onError(result.error)
      return
    }
    onAdded(result.id)
    close(false)
  }

  async function submitDisk() {
    if (!title.trim() || !pick) return
    setBusy(true)
    const files: Record<string, string> = {}
    for (const entry of pick.entries) {
      try {
        files[entry.path] = await entry.file.text()
      } catch {
        files[entry.path] = ""
      }
    }
    const tagList = tags.split(/\s+/).filter((t) => /^[^\s:]+:[^\s:]+$/.test(t))
    const result = await addFromDisk(client, {
      title: title.trim(),
      itemKind: guessKind(pick),
      tags: tagList,
      files,
    })
    setBusy(false)
    if (!result.ok) {
      onError(result.error)
      return
    }
    onAdded(result.id)
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-testid="library-add">
        <DialogHeader>
          <DialogTitle>Add to Library</DialogTitle>
          <DialogDescription>
            Each item is stored as its own folder, even if only one file is
            fetched.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="link">
          <TabsList>
            <TabsTrigger value="link" data-testid="library-add-tab-link">
              From a link
            </TabsTrigger>
            <TabsTrigger value="disk" data-testid="library-add-tab-disk">
              From disk
            </TabsTrigger>
          </TabsList>
          <TabsContent value="link" className="flex flex-col gap-3 pt-2">
            <LinkInput url={url} onUrl={setUrl} />
            <DetectCard
              url={url}
              match={match}
              existing={existing}
              onOpenExisting={(id) => {
                close(false)
                onOpenExisting?.(id)
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button
                disabled={!match || !!existing || busy}
                data-testid="library-add-link-submit"
                onClick={() => void submitLink()}
              >
                Add and fetch
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="disk" className="flex flex-col gap-3 pt-2">
            <DiskPickerBoth
              value={pick}
              onPick={(p) => {
                setPick(p)
                if (p) setTitle(p.label)
              }}
            />
            <Field>
              <FieldLabel htmlFor="lib-title">Name</FieldLabel>
              <Input
                id="lib-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brand guidelines"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="lib-tags">Tags</FieldLabel>
              <Input
                id="lib-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="project:auth type:design"
              />
            </Field>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button
                disabled={!title.trim() || !pick || busy}
                data-testid="library-add-submit"
                onClick={() => void submitDisk()}
              >
                Add
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function guessKind(pick: DiskPick): "image" | "html" | "other" {
  if (pick.folder) return "other"
  const name = pick.entries[0]?.path ?? ""
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return "image"
  if (/\.html?$/i.test(name)) return "html"
  return "other"
}
