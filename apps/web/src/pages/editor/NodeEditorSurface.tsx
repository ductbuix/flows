import { useEffect, useMemo, useRef, useState } from "react"
import { useReactFlow } from "@xyflow/react"
import {
  ChevronDownIcon,
  PlayIcon,
  Redo2Icon,
  SaveIcon,
  Undo2Icon,
} from "lucide-react"
import { toast } from "sonner"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@workspace/ui/components/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { addEdge, loopWarnings } from "@workspace/shared"
import { ActionButton } from "@/components/ActionButton"
import { TrustStartGate, type StartTarget } from "@/components/TrustStartGate"
import { retryTask } from "@/lib/run-actions"
import { NodeRunContext } from "@/nodes/NodeCard"
import { decideStep, type Decision } from "@/nodes/decide"
import { nodeTextPath } from "@/nodes"
import { AddNodeList } from "./AddNodeList"
import { AddNodeMenu } from "./AddNodeMenu"
import { NodeCanvas } from "./NodeCanvas"
import { NodeSheet } from "./NodeSheet"
import { PastRunCanvas } from "./PastRunCanvas"
import { RunHistoryCard } from "./RunHistoryCard"
import { NodeEmpty } from "./NodeEmpty"
import { kindsForWire, type WireSide } from "./node-add"
import { isEditorTypingTarget } from "./editor-typing"
import { hasTrigger } from "./node-run"
import { useNodeRun } from "./useNodeRun"
import { nextSlot, type Pos } from "./node-canvas-layout"
import type { useNodeEditor } from "./useNodeEditor"

type Editor = ReturnType<typeof useNodeEditor>
type Drop = { wire: WireSide; client: Pos; flow: Pos }

/** Toolbar, canvas or empty state, and the wire-drop picker (BL-094). */
export function NodeEditorSurface({ editor }: { editor: Editor }) {
  const rf = useReactFlow()
  const [drop, setDrop] = useState<Drop | null>(null)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pastRunId, setPastRunId] = useState<string | null>(null)
  const workflow = editor.workflow
  const nodeRun = useNodeRun()
  const { runId, follow } = nodeRun
  const latest = useRef(editor)
  const beginRef = useRef<(target: StartTarget) => void>(undefined)
  useEffect(() => {
    latest.current = editor
  }, [editor])
  const live = nodeRun.live
  const runState = useMemo(
    () => ({
      views: nodeRun.views,
      // Run step (BL-102): the saved workflow, this node, latest upstream results.
      runStep: (id: string) => {
        const wf = latest.current.workflow
        if (!wf) return
        if (latest.current.dirty) toast.info("Save to run")
        else if (live) toast.info("A run is still going")
        else {
          beginRef.current?.({
            mode: "start",
            workflowId: wf.id,
            partial: { only: id },
          })
        }
      },
      retry: (id: string) => {
        if (!runId) return
        void retryTask(runId, id).then((r) => {
          if (!r.ok) toast.error(r.error)
        })
      },
      decide: (id: string, decision: Decision) => {
        if (runId) decideStep(runId, id, decision)
      },
    }),
    [nodeRun.views, runId, live]
  )

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

  const { setSetting, setText, endEdit, removeNode } = editor
  const nodes = workflow?.nodes
  const edits = useMemo(
    () => ({
      setSetting,
      endEdit,
      openSettings: setSheetId,
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

  const warnings = loopWarnings(workflow.nodes, workflow.edges)
  const sheetNode = workflow.nodes.find((n) => n.id === sheetId)

  const addAtSlot = (kind: string) =>
    editor.addNode(kind, nextSlot(rf.getNodes()), current())

  return (
    <>
      <div
        className="flex shrink-0 items-center justify-end gap-2 py-2"
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
        <TrustStartGate onStarted={(_wf, id) => follow(id)}>
          {({ begin, pending }) => {
            beginRef.current = begin
            const hint = !hasTrigger(workflow.nodes)
              ? "Add a trigger to run"
              : editor.dirty
                ? "Save to run"
                : null
            return (
              <>
                {hint ? (
                  <span
                    className="text-xs text-muted-foreground"
                    data-testid="node-run-hint"
                  >
                    {hint}
                  </span>
                ) : null}
                <ButtonGroup>
                  <ActionButton
                    variant="outline"
                    data-testid="canvas-run"
                    pending={pending || nodeRun.live}
                    disabled={hint !== null}
                    onClick={() =>
                      begin({ mode: "start", workflowId: workflow.id })
                    }
                  >
                    <PlayIcon data-icon="inline-start" />
                    Run
                  </ActionButton>
                  <ButtonGroupSeparator />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Run menu"
                          data-testid="canvas-run-menu"
                          disabled={pending || nodeRun.live}
                        />
                      }
                    >
                      <ChevronDownIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        data-testid="canvas-run-from"
                        disabled={hint !== null || selectedId === null}
                        onClick={() =>
                          selectedId !== null &&
                          begin({
                            mode: "start",
                            workflowId: workflow.id,
                            partial: { from: selectedId },
                          })
                        }
                      >
                        Run from selected node
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ButtonGroup>
              </>
            )
          }}
        </TrustStartGate>
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
      {warnings.length > 0 ? (
        <div className="shrink-0 pb-2">
          <Alert data-testid="loop-warnings">
            <AlertTitle>Loop without a Judge</AlertTitle>
            <AlertDescription>
              {warnings.map((w) => (
                <p key={w.index}>{w.message}</p>
              ))}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      <div data-bleed className="relative min-h-0 flex-1 border-t">
        {pastRunId ? (
          <PastRunCanvas
            key={pastRunId}
            runId={pastRunId}
            onBack={() => setPastRunId(null)}
          />
        ) : workflow.nodes.length === 0 ? (
          <NodeEmpty
            onAddTrigger={() => addAtSlot("trigger")}
            onSample={() => editor.addSample(current())}
          />
        ) : (
          <NodeRunContext.Provider value={runState}>
            <NodeCanvas
              workflow={workflow}
              saved={editor.saved}
              edits={edits}
              textOf={editor.textOf}
              onPositions={editor.savePositions}
              onWire={(edge) => editor.addEdgeYaml((y) => addEdge(y, edge))}
              onDrop={setDrop}
              onSelect={setSelectedId}
            />
          </NodeRunContext.Provider>
        )}
        <RunHistoryCard
          workflowId={workflow.id}
          pickedId={pastRunId}
          onPick={setPastRunId}
        />
      </div>
      {sheetNode ? (
        <NodeSheet
          key={sheetNode.id}
          workflowId={workflow.id}
          graph={workflow}
          node={sheetNode}
          onSetting={(key, value) => setSetting(sheetNode.id, key, value)}
          onEditEnd={endEdit}
          onDelete={() => {
            setSheetId(null)
            removeNode(sheetNode.id)
          }}
          onClose={() => {
            endEdit()
            setSheetId(null)
          }}
        />
      ) : null}
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
