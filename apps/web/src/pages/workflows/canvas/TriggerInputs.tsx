import { useState } from "react"
import { Plus, X } from "lucide-react"
import type { WorkflowInputDecl } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

type Props = {
  inputs: WorkflowInputDecl[]
  onChange: (inputs: WorkflowInputDecl[]) => void
}

/** Declared inputs a card must supply when it runs this workflow. */
export function TriggerInputs({ inputs, onChange }: Props) {
  const [draft, setDraft] = useState("")
  function add() {
    const name = draft.trim()
    if (name && !inputs.some((i) => i.name === name)) {
      onChange([...inputs, { name, type: "text", required: true }])
    }
    setDraft("")
  }
  return (
    <div className="flex flex-col gap-2" data-testid="trigger-inputs">
      <div className="flex flex-wrap gap-1.5">
        {inputs.length === 0 ? (
          <span className="text-sm text-muted-foreground">No inputs yet</span>
        ) : (
          inputs.map((i) => (
            <Badge key={i.name} variant="outline">
              {i.name}
              <button
                type="button"
                aria-label={`Remove ${i.name}`}
                data-testid={`trigger-input-remove-${i.name}`}
                onClick={() =>
                  onChange(inputs.filter((x) => x.name !== i.name))
                }
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Input
          aria-label="New input"
          placeholder="Input name, e.g. ticket"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          data-testid="trigger-input-draft"
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Add input"
          data-testid="trigger-input-add"
          onClick={add}
        >
          <Plus />
        </Button>
      </div>
    </div>
  )
}
