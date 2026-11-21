import { useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import type { CliModelCatalog, Effort } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

const CUSTOM = "__custom__"
const DEFAULT = ""

type Props = {
  catalog: CliModelCatalog | null
  model: string | undefined
  effort: Effort | undefined
  onChangeModel: (model: string | undefined) => void
  onChangeEffort: (effort: Effort | undefined) => void
  disabled?: boolean
  /** Prefix for data-testid (e.g. "when-" for judge leaves). */
  idPrefix?: string
}

/** Model and Effort menus (AI Elements / DES-023). */
export function ModelSelector({
  catalog,
  model,
  effort,
  onChangeModel,
  onChangeEffort,
  disabled,
  idPrefix = "",
}: Props) {
  const modelInCatalog = catalog?.models.some((m) => m.id === model) ?? false
  const isCustom = Boolean(model) && !modelInCatalog
  const [customDraft, setCustomDraft] = useState(isCustom ? model! : "")
  const [modelOpen, setModelOpen] = useState(false)
  const [effortOpen, setEffortOpen] = useState(false)
  const modelValue = !model ? DEFAULT : isCustom ? CUSTOM : model
  const selectedModel = catalog?.models.find((m) => m.id === model)
  const effortOptions = selectedModel?.efforts ?? catalogEffortFallback(catalog)
  const modelLabel = !model
    ? (catalog?.defaultLabel ?? "Default")
    : isCustom
      ? model
      : (selectedModel?.label ?? model)
  const effortLabel = !effort ? "Default" : capitalize(effort)

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={`${idPrefix}model-selector`}
    >
      <DropdownMenu open={modelOpen} onOpenChange={setModelOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || !catalog}
              data-testid={`${idPrefix}field-model`}
            />
          }
        >
          {modelLabel}
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuRadioGroup
            value={modelValue}
            onValueChange={(v) => {
              if (v === DEFAULT) {
                onChangeModel(undefined)
                setModelOpen(false)
                return
              }
              if (v === CUSTOM) {
                const next = customDraft.trim() || "custom"
                setCustomDraft(next)
                onChangeModel(next)
                return
              }
              onChangeModel(v)
              setModelOpen(false)
            }}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Model</DropdownMenuLabel>
              <DropdownMenuRadioItem value={DEFAULT}>
                {catalog?.defaultLabel ?? "Default"}
              </DropdownMenuRadioItem>
              {(catalog?.models ?? []).map((m) => (
                <DropdownMenuRadioItem key={m.id} value={m.id}>
                  {m.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioItem value={CUSTOM}>
              Custom…
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          {modelValue === CUSTOM || isCustom ? (
            <div className="p-2 pt-1">
              <Input
                data-testid={`${idPrefix}field-model-custom`}
                value={customDraft}
                placeholder="custom model id"
                onChange={(e) => {
                  const next = e.target.value
                  setCustomDraft(next)
                  const trimmed = next.trim()
                  onChangeModel(trimmed === "" ? undefined : trimmed)
                }}
              />
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu open={effortOpen} onOpenChange={setEffortOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || !catalog}
              data-testid={`${idPrefix}field-effort`}
            />
          }
        >
          {effortLabel}
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-36">
          <DropdownMenuRadioGroup
            value={effort ?? DEFAULT}
            onValueChange={(v) => {
              if (v === DEFAULT) onChangeEffort(undefined)
              else onChangeEffort(v as Effort)
              setEffortOpen(false)
            }}
          >
            <DropdownMenuRadioItem value={DEFAULT}>
              Default
            </DropdownMenuRadioItem>
            {effortOptions.map((e) => (
              <DropdownMenuRadioItem key={e} value={e}>
                {capitalize(e)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function catalogEffortFallback(catalog: CliModelCatalog | null): Effort[] {
  if (!catalog) return []
  const set = new Set<Effort>()
  for (const m of catalog.models) {
    for (const e of m.efforts) set.add(e)
  }
  return [...set]
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
