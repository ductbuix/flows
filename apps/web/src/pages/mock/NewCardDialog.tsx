import { useState } from "react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { MOCK_TODAY, type Card } from "./docket-data"
import { useColumns } from "./columns-store"
import { refFromLink } from "./ref-from-link"

type Props = {
  open: boolean
  defaultStatus: string
  existingIds: string[]
  onOpenChange: (open: boolean) => void
  onCreate: (card: Card) => void
}

function slug(title: string, taken: string[]): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "card"
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}

export function NewCardDialog({
  open,
  defaultStatus,
  existingIds,
  onOpenChange,
  onCreate,
}: Props) {
  const columns = useColumns()
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState(defaultStatus)
  const [link, setLink] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setTitle("")
    setStatus(defaultStatus)
    setLink("")
    setBody("")
    setError(null)
  }

  function submit() {
    if (!title.trim()) {
      setError("Title is required.")
      return
    }
    const ref = link.trim() ? refFromLink(link.trim()) : null
    if (link.trim() && !ref) {
      setError("Ref must be a full URL, for example https://...")
      return
    }
    const today = MOCK_TODAY
    onCreate({
      id: slug(title, existingIds),
      title: title.trim(),
      status,
      created: today,
      updated: today,
      refs: ref ? [ref] : [],
      assets: [],
      links: [],
      fields: {},
      body: body.trim(),
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="docket-new-card">
        <DialogHeader>
          <DialogTitle>New card</DialogTitle>
          <DialogDescription>
            Add a card to the board. Add a ref to the source ticket now, or
            attach files later.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="nc-title">Title</FieldLabel>
          <Input
            id="nc-title"
            data-testid="docket-new-card-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
          />
        </Field>
        <Field>
          <FieldLabel>Column</FieldLabel>
          <Select
            value={status}
            items={columns.map((c) => ({ value: c.id, label: c.label }))}
            onValueChange={(v) => v && setStatus(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {columns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="nc-ref">Ref</FieldLabel>
          <Input
            id="nc-ref"
            data-testid="docket-new-card-ref"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Optional: URL of the ticket or page this card wraps"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="nc-body">Description</FieldLabel>
          <Textarea
            id="nc-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Optional Markdown"
          />
        </Field>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button data-testid="docket-new-card-submit" onClick={submit}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
