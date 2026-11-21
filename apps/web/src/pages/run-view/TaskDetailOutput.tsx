import { useEffect, useState } from "react"
import { outListSchema } from "@workspace/shared"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import { api } from "@/lib/api"

type Props = {
  runId: string
  taskId: string
  attemptN: number
}

export function TaskDetailOutput({ runId, taskId, attemptN }: Props) {
  const slot = `${runId}:${taskId}:${attemptN}`
  const [state, setState] = useState<{ slot: string; files: string[] } | null>(
    null
  )
  const loading = state === null || state.slot !== slot

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.runs[":runId"].tasks[":taskId"].attempts[
        ":n"
      ].out.$get({
        param: { runId, taskId, n: String(attemptN) },
      })
      if (!res.ok || !alive) return
      const out = outListSchema.parse(await res.json())
      setState({ slot, files: out.files.map((f) => f.path) })
    })()
    return () => {
      alive = false
    }
  }, [runId, taskId, attemptN, slot])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading output…</p>
  }

  if (state!.files.length === 0) {
    return (
      <Empty>
        <EmptyTitle>No output files</EmptyTitle>
        <EmptyDescription>The out/ folder is empty.</EmptyDescription>
        <EmptyContent />
      </Empty>
    )
  }

  return (
    <ItemGroup>
      {state!.files.map((path) => (
        <Item key={path} size="sm" variant="outline">
          <ItemContent>
            <ItemTitle className="font-mono">{path}</ItemTitle>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}
