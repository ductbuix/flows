/**
 * Adapted from shadcn apps/v4/examples/base/prompt-input-demo.tsx (shadcn-ui/ui@bfa64ff).
 * Changed base-rhea to base-nova: imports use @workspace/ui/components/*, not @/styles/base-rhea/ui/*; chat demo wiring (useChat, Bubble, Message) removed.
 */
import type { FormEvent, KeyboardEvent } from "react"
import { ArrowUpIcon } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group"

type Props = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  submitLabel?: string
  "data-testid"?: string
  submitTestId?: string
}

/**
 * Prompt Input (AI Elements): textarea + submit in an Input Group.
 * Enter submits; Shift+Enter inserts a newline.
 */
export function PromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Write the agent prompt…",
  disabled,
  submitLabel = "Save",
  "data-testid": testId,
  submitTestId,
}: Props) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (disabled) return
    onSubmit()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!disabled) onSubmit()
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid={testId}>
      <InputGroup className="h-auto min-h-40 items-stretch">
        <InputGroupTextarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-32 p-3 font-mono text-xs"
          rows={12}
        />
        <InputGroupAddon align="block-end" className="justify-end border-t">
          <InputGroupButton
            type="submit"
            size="sm"
            variant="default"
            disabled={disabled}
            className="ml-auto"
            data-testid={submitTestId}
            aria-label={submitLabel}
          >
            <ArrowUpIcon />
            {submitLabel}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
