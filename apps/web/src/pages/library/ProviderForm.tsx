import { useState } from "react"
import type { ProviderAccess, ProviderDescriptor } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
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

const ACCESS = [
  { value: "read", label: "Read only" },
  { value: "readwrite", label: "Read and write" },
] as const

export function ProviderForm({
  onSubmit,
  onCancel,
  busy,
}: {
  onSubmit: (provider: ProviderDescriptor) => void
  onCancel: () => void
  busy: boolean
}) {
  const [label, setLabel] = useState("")
  const [pattern, setPattern] = useState("")
  const [files, setFiles] = useState("")
  const [fetch, setFetch] = useState("")
  const [access, setAccess] = useState<ProviderAccess>("read")
  const valid = (() => {
    try {
      return new RegExp(pattern).source.includes("(?<id>")
    } catch {
      return false
    }
  })()

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl p-3 ring-1 ring-foreground/10"
      data-testid="provider-form"
    >
      <Field>
        <FieldLabel htmlFor="pv-name">Name</FieldLabel>
        <Input
          id="pv-name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Grafana"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="pv-pattern">
          Link pattern (needs an id group)
        </FieldLabel>
        <Input
          id="pv-pattern"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="grafana[^/]*/d/(?<id>[^/]+)"
          className={mono}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="pv-files">
          Files a fetch writes (comma separated)
        </FieldLabel>
        <Input
          id="pv-files"
          value={files}
          onChange={(e) => setFiles(e.target.value)}
          placeholder="dashboard.json, panels/cpu.csv"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="pv-fetch">Command or API call</FieldLabel>
        <Input
          id="pv-fetch"
          value={fetch}
          onChange={(e) => setFetch(e.target.value)}
          placeholder="Grafana API GET /api/dashboards/uid/{id}"
        />
      </Field>
      <Field>
        <FieldLabel>Access</FieldLabel>
        <Select
          value={access}
          items={[...ACCESS]}
          onValueChange={(v) => v && setAccess(v as ProviderAccess)}
        >
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
          disabled={busy || !label.trim() || !valid || !files.trim()}
          data-testid="provider-add-submit"
          onClick={() => {
            const id = label
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
            onSubmit({
              id,
              label: label.trim(),
              icon: "other",
              pattern,
              example: "",
              layout: files
                .split(",")
                .map((f) => f.trim())
                .filter(Boolean),
              tags: [`${id}:{id}`],
              access,
              fetch: fetch.trim() || "Custom command",
              custom: true,
            })
          }}
        >
          Add provider
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={onCancel}
          data-testid="provider-add-cancel"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
