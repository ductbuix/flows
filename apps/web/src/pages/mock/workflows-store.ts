import { useSyncExternalStore } from "react"
import { flowFor, type Flow } from "./flow-data"
import { WORKFLOWS, type MockWorkflow } from "./workflows-data"

/** In-memory workflows and their canvases; lost on reload. */
let list: MockWorkflow[] = WORKFLOWS
const flows = new Map<string, Flow>()
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getWorkflows = () => list
export const useWorkflows = () => useSyncExternalStore(subscribe, getWorkflows)

export function getFlow(id: string): Flow {
  return flows.get(id) ?? flowFor(id)
}

/** Keeps the canvas as edited; run overlays are not saved. */
export function saveFlow(id: string, flow: Flow) {
  flows.set(id, {
    edges: flow.edges,
    nodes: flow.nodes.map((n) => ({
      ...n,
      data: { ...n.data, state: undefined, result: undefined },
    })),
  })
}

function slug(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workflow"
  let id = base
  for (let n = 2; list.some((w) => w.id === id); n++) id = `${base}-${n}`
  return id
}

/** A new workflow starts with its one required trigger. */
export function addWorkflow(name: string, solves: string): MockWorkflow {
  const wf: MockWorkflow = { id: slug(name), name, solves, inputs: [] }
  list = [wf, ...list]
  flows.set(wf.id, {
    nodes: [{ id: "t", type: "trigger", position: { x: 0, y: 0 }, data: {} }],
    edges: [],
  })
  listeners.forEach((fn) => fn())
  return wf
}

export function renameWorkflow(id: string, name: string, solves: string) {
  list = list.map((w) => (w.id === id ? { ...w, name, solves } : w))
  listeners.forEach((fn) => fn())
}

/** Removes the workflow and its canvas; its runs go with it (see removeRunsOf). */
export function deleteWorkflow(id: string) {
  list = list.filter((w) => w.id !== id)
  flows.delete(id)
  listeners.forEach((fn) => fn())
}

export function setWorkflowInputs(id: string, inputs: string[]) {
  list = list.map((w) => (w.id === id ? { ...w, inputs } : w))
  listeners.forEach((fn) => fn())
}
