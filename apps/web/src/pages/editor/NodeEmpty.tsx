import {
  ArrowRightIcon,
  BotIcon,
  FolderOutputIcon,
  ZapIcon,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { KIND_META } from "./node-kind-ui"

const BLOCK_ICONS = {
  trigger: ZapIcon,
  agent: BotIcon,
  output: FolderOutputIcon,
} as const

function Block({ kind }: { kind: keyof typeof BLOCK_ICONS }) {
  const meta = KIND_META[kind]!
  const Icon = BLOCK_ICONS[kind]
  return (
    <Card className="w-28 flex-row items-center gap-2 px-3 py-2">
      <Icon className="size-4 shrink-0" />
      <span className="text-sm font-medium">{meta.label}</span>
    </Card>
  )
}

type Props = { onAddTrigger: () => void; onSample: () => void }

/** A new workflow: what a flow looks like, and two ways to start. */
export function NodeEmpty({ onAddTrigger, onSample }: Props) {
  return (
    <div className="flex h-full flex-col">
      <Empty data-testid="node-empty">
        <div
          aria-hidden
          className="flex items-center gap-2"
          data-testid="node-empty-diagram"
        >
          <Block kind="trigger" />
          <ArrowRightIcon className="size-4 text-muted-foreground" />
          <Block kind="agent" />
          <ArrowRightIcon className="size-4 text-muted-foreground" />
          <Block kind="output" />
        </div>
        <EmptyHeader>
          <EmptyTitle>Build your flow from nodes</EmptyTitle>
          <EmptyDescription>
            A trigger starts every run. Wire it to steps that do the work, and
            end with an output that keeps the result.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button type="button" onClick={onAddTrigger}>
            Add a trigger
          </Button>
          <Button type="button" variant="outline" onClick={onSample}>
            Start from a sample
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
