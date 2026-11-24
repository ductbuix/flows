import { useState } from "react"
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
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@workspace/ui/components/tabs"
import { addItem, addRemote } from "./library-store"
import { DiskPicker, type DiskPick } from "./DiskPicker"
import { DetectCard, LinkInput, useLinkField } from "./ProviderDetect"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the new item's id. */
  onAdded: (id: string) => void
  onOpenExisting?: (id: string) => void
}

/** Add by link (read-only fetch) or copy from disk. Every item becomes a folder. */
export function AddLibraryDialog({
  open,
  onOpenChange,
  onAdded,
  onOpenExisting,
}: Props) {
  const link = useLinkField()
  const [pick, setPick] = useState<DiskPick | null>(null)
  const [title, setTitle] = useState("")
  const [tags, setTags] = useState("")

  function close(next: boolean) {
    if (!next) {
      link.setUrl("")
      setTitle("")
      setTags("")
      setPick(null)
    }
    onOpenChange(next)
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
            <LinkInput url={link.url} onUrl={link.setUrl} />
            <DetectCard
              url={link.url}
              match={link.match}
              existing={link.existing}
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
                disabled={!link.match || !!link.existing}
                data-testid="library-add-link-submit"
                onClick={() => {
                  if (!link.match) return
                  onAdded(addRemote(link.match))
                  close(false)
                }}
              >
                Add and fetch
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="disk" className="flex flex-col gap-3 pt-2">
            <DiskPicker
              value={pick}
              onChange={(p) => {
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
                disabled={!title.trim() || !pick}
                data-testid="library-add-submit"
                onClick={() => {
                  onAdded(
                    addItem(
                      pick?.kind ?? "other",
                      title.trim(),
                      tags
                        .split(/\s+/)
                        .filter((t) => /^[^\s:]+:[^\s:]+$/.test(t)),
                      pick?.assets
                    )
                  )
                  close(false)
                }}
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
