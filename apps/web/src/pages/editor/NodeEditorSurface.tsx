import { useEffect, useMemo, useRef, useState } from "react"
import { useReactFlow } from "@xyflow/react"
import { Redo2Icon, SaveIcon, Undo2Icon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { addEdge } from "@workspace/shared"
import { nodeTextPath } from "@/nodes"
import { AddNodeList } from "./AddNodeList"
import { AddNodeMenu } from "./AddNodeMenu"
import { NodeCanvas } from "./NodeCanvas"
import { NodeEmpty } from "./NodeEmpty"
import { kindsForWire, type WireSide } from "./node-add"
import { isEditorTypingTarget } from "./editor-typing"
import { nextSlot, type Pos } from "./node-canvas-layout"
import type { useNodeEditor } from "./useNodeEditor"

type Editor = ReturnType<typeof useNodeEditor>
type Drop = { wire: WireSide; client: Pos; flow: Pos }

/** Toolbar, canvas or empty state, and the wire-drop picker (BL-094). */
export function NodeEditorSurface({ editor }: { editor: Editor }) {
  const rf = useReactFlow()
  const [drop, setDrop] = useState<Drop | null>(null)
  const workflow = editor.workflow
  const latest = useRef(editor)
  latest.current = editor

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (meta && key === "s") {
        e.preventDefault()
        void latest.current.save()
        return
      }
      // Typing fields keep their own undo.
      if (isEditorTypingTarget(e.target)) return
      if (meta && key === "z") {
        e.preventDefault()
        if (e.shiftKey) latest.current.redo()
        else latest.current.undo()
      } else if (e.ctrlKey && key === "y") {
        e.preventDefault()
        latest.current.redo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const { setSetting, setText, endEdit } = editor
  const nodes = workflow?.nodes
  const edits = useMemo(
    () => ({
      setSetting,
      endEdit,
      setText: (id: string, text: string) => {
        const node = nodes?.find((n) => n.id === id)
        const path = node ? nodeTextPath(node) : null
        if (path) setText(path, text)
      },
    }),
    [setSetting, setText, endEdit, nodes]
  )

  if (!workflow) return null

  const current = (): Record<string, Pos> =>
    Object.fromEntries(
      rf.getNodes().map((n) => [n.id, { x: n.position.x, y: n.position.y }])
    )

  const addAtSlot = (kind: string) =>
    editor.addNode(kind, nextSlot(rf.getNodes()), current())

  return (
    <>
      <div
        className="flex shrink-0 items-center justify-end gap-2 px-6 py-2"
        data-testid="node-toolbar"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Undo"
          data-testid="node-undo"
          disabled={!editor.canUndo}
          onClick={editor.undo}
        >
          <Undo2Icon />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Redo"
          data-testid="node-redo"
          disabled={!editor.canRedo}
          onClick={editor.redo}
        >
          <Redo2Icon />
        </Button>
        <AddNodeMenu onPick={addAtSlot} />
        <Button
          type="button"
          data-testid="node-save"
          disabled={!editor.dirty}
          onClick={() => void editor.save()}
        >
          <SaveIcon data-icon="inline-start" />
          Save
        </Button>
      </div>
      <div data-bleed className="min-h-0 flex-1 border-t">
        {workflow.nodes.length === 0 ? (
          <NodeEmpty
            onAddTrigger={() => addAtSlot("trigger")}
            onSample={() => editor.addSample(current())}
          />
        ) : (
          <NodeCanvas
            workflow={workflow}
            saved={editor.saved}
            edits={edits}
            textOf={editor.textOf}
            onPositions={editor.savePositions}
            onWire={(edge) => editor.addEdgeYaml((y) => addEdge(y, edge))}
            onDrop={setDrop}
          />
        )}
      </div>
      {drop ? (
        <Popover open onOpenChange={(open) => !open && setDrop(null)}>
          <PopoverTrigger
            render={
              <span
                aria-hidden
                className="fixed size-px"
                style={{ left: drop.client.x, top: drop.client.y }}
              />
            }
          />
          <PopoverContent
            align="start"
            className="w-80 gap-0 p-0"
            data-testid="add-connected-node"
          >
            <PopoverHeader className="px-2.5 pt-2.5">
              <PopoverTitle>Add a connected node</PopoverTitle>
            </PopoverHeader>
            <AddNodeList
              title="Add a connected node"
              kinds={kindsForWire(drop.wire.handle)}
              onPick={(kind) => {
                editor.addNode(kind, drop.flow, current(), drop.wire)
                setDrop(null)
              }}
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </>
  )
}
