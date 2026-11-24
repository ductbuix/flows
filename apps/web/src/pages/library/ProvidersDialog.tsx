import { useState } from "react"
import {
  DEFAULT_PROVIDERS,
  type ProviderDescriptor,
} from "@workspace/contracts"
import { Plus } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { mono } from "@/components/data/mono"
import { LibraryProvidersEmpty } from "./LibraryStates"
import { ProviderForm } from "./ProviderForm"

const ACCESS = [
  { value: "read", label: "Read only" },
  { value: "readwrite", label: "Read and write" },
] as const

export const accessLabel = (p: ProviderDescriptor) =>
  ACCESS.find((a) => a.value === p.access)?.label

/** Providers decide how a link is recognised, what a fetch writes and whether changes can go back. */
export function ProvidersDialog({
  open,
  onOpenChange,
  providers,
  busy,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  providers: readonly ProviderDescriptor[]
  busy: boolean
  onSave: (provider: ProviderDescriptor) => void
}) {
  const [custom, setCustom] = useState(false)
  const available = DEFAULT_PROVIDERS.filter(
    (p) => !providers.some((x) => x.id === p.id)
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCustom(false)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-xl" data-testid="providers-dialog">
        <DialogHeader>
          <DialogTitle>Providers</DialogTitle>
          <DialogDescription>
            A provider tells the Library how to recognise a link, which files a
            fetch writes and whether local changes can go back.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
          {providers.length === 0 ? <LibraryProvidersEmpty /> : null}
          {providers.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-2 border-b pb-3 text-sm last:border-b-0"
              data-testid={`provider-${p.id}`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.label}</span>
                  <Badge
                    variant={p.access === "readwrite" ? "secondary" : "outline"}
                  >
                    {accessLabel(p)}
                  </Badge>
                  {p.custom ? <Badge variant="outline">Custom</Badge> : null}
                </div>
                <span className="text-muted-foreground">{p.fetch}</span>
                <span
                  className={`${mono} truncate text-xs text-muted-foreground`}
                >
                  {p.pattern}
                </span>
              </div>
            </div>
          ))}
        </div>
        {custom ? (
          <ProviderForm
            busy={busy}
            onCancel={() => setCustom(false)}
            onSubmit={(provider) => {
              onSave(provider)
              setCustom(false)
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="provider-add-row">
            {available.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                disabled={busy}
                onClick={() => onSave(p)}
                data-testid={`provider-preset-${p.id}`}
              >
                <Plus />
                {p.label}
              </Button>
            ))}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setCustom(true)}
              data-testid="provider-add-open"
            >
              <Plus />
              Custom…
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
