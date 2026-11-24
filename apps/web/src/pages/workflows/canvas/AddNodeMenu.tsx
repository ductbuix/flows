import { useState } from "react"
import { Plus, Search } from "lucide-react"
import type { NodeKindName } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { KIND_GROUPS, KIND_LABEL } from "./flow-kinds"

type Props = {
  hasTrigger: boolean
  onPick: (kind: NodeKindName) => void
}

/** Toolbar popover: search and pick a registry kind (BL-202 / WF-11). */
export function AddNodeMenu({ hasTrigger, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const groups = KIND_GROUPS.map((g) => ({
    ...g,
    kinds: g.kinds.filter((k) =>
      KIND_LABEL[k].toLowerCase().includes(q.trim().toLowerCase())
    ),
  })).filter((g) => g.kinds.length > 0)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button data-testid="flow-add-node" />}>
        <Plus />
        Add node
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-64 gap-2 p-2">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search nodes"
            data-testid="flow-add-node-search"
          />
        </InputGroup>
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-0.5">
            <span className="px-2 pt-1 text-xs text-muted-foreground">
              {g.title}
            </span>
            {g.kinds.map((k) => (
              <Button
                key={k}
                variant="ghost"
                className="justify-start"
                disabled={k === "trigger" && hasTrigger}
                data-testid={`flow-add-kind-${k}`}
                onClick={() => {
                  setOpen(false)
                  setQ("")
                  onPick(k)
                }}
              >
                {KIND_LABEL[k]}
                {k === "trigger" && hasTrigger ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    one only
                  </span>
                ) : null}
              </Button>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
