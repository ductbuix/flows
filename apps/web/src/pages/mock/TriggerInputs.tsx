import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

type Props = { inputs: string[]; onChange: (inputs: string[]) => void }

/** What a card must supply when it runs this workflow. */
export function TriggerInputs({ inputs, onChange }: Props) {
  const [draft, setDraft] = useState("")
  function add() {
    const v = draft.trim()
    if (v && !inputs.includes(v)) onChange([...inputs, v])
    setDraft("")
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {inputs.length === 0 ? (
          <span className="text-sm text-muted-foreground">No inputs yet</span>
        ) : (
          inputs.map((i) => (
            <Badge key={i} variant="outline">
              {i}
              <button
                type="button"
                aria-label={`Remove ${i}`}
                onClick={() => onChange(inputs.filter((x) => x !== i))}
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
        />
        <Button variant="outline" size="icon" aria-label="Add input" onClick={add}>
          <Plus />
        </Button>
      </div>
    </div>
  )
}
