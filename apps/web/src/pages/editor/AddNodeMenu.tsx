import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { AddNodeList } from "./AddNodeList"

/** Toolbar "Add node": a Popover with the searchable kind list (DES-036). */
export function AddNodeMenu({ onPick }: { onPick: (kind: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" data-testid="add-node" />
        }
      >
        <PlusIcon data-icon="inline-start" />
        Add node
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-0">
        <AddNodeList
          title="Add node"
          onPick={(kind) => {
            setOpen(false)
            onPick(kind)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
