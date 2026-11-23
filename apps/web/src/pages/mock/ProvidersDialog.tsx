import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { mono } from "@/components/data/mono"
import { PRESETS, type Provider } from "./library-providers"
import { addProvider, removeProvider, useProviders } from "./library-store"

const ACCESS = [
  { value: "read", label: "Read only" },
  { value: "readwrite", label: "Read and write" },
]

export const accessLabel = (p: Provider) => ACCESS.find((a) => a.value === p.access)?.label

function CustomForm({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState("")
  const [pattern, setPattern] = useState("")
  const [files, setFiles] = useState("")
  const [fetch, setFetch] = useState("")
  const [access, setAccess] = useState<Provider["access"]>("read")
  const valid = (() => {
    try {
      return new RegExp(pattern).source.includes("(?<id>")
    } catch {
      return false
    }
  })()
  return (
    <div className="flex flex-col gap-3 rounded-2xl p-3 ring-1 ring-foreground/10" data-testid="provider-form">
      <Field>
        <FieldLabel htmlFor="pv-name">Name</FieldLabel>
        <Input id="pv-name" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Grafana" />
      </Field>
      <Field>
        <FieldLabel htmlFor="pv-pattern">Link pattern (needs an id group)</FieldLabel>
        <Input id="pv-pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="grafana[^/]*/d/(?<id>[^/]+)" className={mono} />
      </Field>
      <Field>
        <FieldLabel htmlFor="pv-files">Files a fetch writes (comma separated)</FieldLabel>
        <Input id="pv-files" value={files} onChange={(e) => setFiles(e.target.value)} placeholder="dashboard.json, panels/cpu.csv" />
      </Field>
      <Field>
        <FieldLabel htmlFor="pv-fetch">Command or API call</FieldLabel>
        <Input id="pv-fetch" value={fetch} onChange={(e) => setFetch(e.target.value)} placeholder="Grafana API GET /api/dashboards/uid/{id}" />
      </Field>
      <Field>
        <FieldLabel>Access</FieldLabel>
        <Select value={access} items={ACCESS} onValueChange={(v) => v && setAccess(v as Provider["access"])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {ACCESS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="flex gap-2">
        <Button
          disabled={!label.trim() || !valid || !files.trim()}
          data-testid="provider-add-submit"
          onClick={() => {
            const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
            addProvider({
              id,
              label: label.trim(),
              icon: "other",
              pattern,
              example: "",
              layout: files.split(",").map((f) => f.trim()).filter(Boolean),
              tags: [`${id}:{id}`],
              access,
              fetch: fetch.trim() || "Custom command",
              custom: true,
            })
            onDone()
          }}
        >
          Add provider
        </Button>
        <Button variant="outline" onClick={onDone} data-testid="provider-add-cancel">
          Cancel
        </Button>
      </div>
    </div>
  )
}

/** Providers decide how a link is recognised, what a fetch writes and whether changes can go back. */
export function ProvidersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const providers = useProviders()
  const [custom, setCustom] = useState(false)
  const available = PRESETS.filter((p) => !providers.some((x) => x.id === p.id))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" data-testid="providers-dialog">
        <DialogHeader>
          <DialogTitle>Providers</DialogTitle>
          <DialogDescription>
            A provider tells the Library how to recognise a link, which files a fetch writes and whether local changes can go back. Removing one keeps its items; they just cannot be fetched.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
          {providers.length === 0 ? <p className="text-sm text-muted-foreground">No providers. Add one below.</p> : null}
          {providers.map((p) => (
            <div key={p.id} className="flex items-start gap-2 border-b pb-3 text-sm last:border-b-0" data-testid={`provider-${p.id}`}>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.label}</span>
                  <Badge variant={p.access === "readwrite" ? "secondary" : "outline"}>{accessLabel(p)}</Badge>
                  {p.custom ? <Badge variant="outline">Custom</Badge> : null}
                </div>
                <span className="text-muted-foreground">{p.fetch}</span>
                <span className={`${mono} truncate text-xs text-muted-foreground`}>{p.pattern}</span>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Remove ${p.label}`} onClick={() => removeProvider(p.id)} data-testid={`provider-remove-${p.id}`}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        {custom ? (
          <CustomForm onDone={() => setCustom(false)} />
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="provider-add-row">
            {available.map((p) => (
              <Button key={p.id} variant="outline" onClick={() => addProvider(p)} data-testid={`provider-preset-${p.id}`}>
                <Plus />
                {p.label}
              </Button>
            ))}
            <Button variant="outline" onClick={() => setCustom(true)} data-testid="provider-add-open">
              <Plus />
              Custom…
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
