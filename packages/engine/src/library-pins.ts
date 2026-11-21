import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { ResourcePin } from "@workspace/shared"
import { readResourcesJson } from "./library.ts"

export type PinKey = {
  connection: string
  kind: string
  entityId: string
  revision: string
}

export function pinKey(pin: PinKey): string {
  return `${pin.connection}\0${pin.kind}\0${pin.entityId}\0${pin.revision}`
}

/** Every pin from every run's resources.json under workflows/. */
export function collectAllPins(home: string): ResourcePin[] {
  const workflowsRoot = join(home, "workflows")
  if (!existsSync(workflowsRoot)) return []
  const pins: ResourcePin[] = []
  for (const wf of readdirSync(workflowsRoot, { withFileTypes: true })) {
    if (!wf.isDirectory()) continue
    const runsRoot = join(workflowsRoot, wf.name, "runs")
    if (!existsSync(runsRoot)) continue
    for (const run of readdirSync(runsRoot, { withFileTypes: true })) {
      if (!run.isDirectory()) continue
      const res = readResourcesJson(join(runsRoot, run.name))
      if (!res) continue
      pins.push(...res.pins)
    }
  }
  return pins
}

/** Run ids that pin this exact revision. */
export function listPinningRuns(
  home: string,
  connectionId: string,
  kind: string,
  entityId: string,
  revision: string
): string[] {
  const workflowsRoot = join(home, "workflows")
  if (!existsSync(workflowsRoot)) return []
  const ids: string[] = []
  for (const wf of readdirSync(workflowsRoot, { withFileTypes: true })) {
    if (!wf.isDirectory()) continue
    const runsRoot = join(workflowsRoot, wf.name, "runs")
    if (!existsSync(runsRoot)) continue
    for (const run of readdirSync(runsRoot, { withFileTypes: true })) {
      if (!run.isDirectory()) continue
      const res = readResourcesJson(join(runsRoot, run.name))
      if (!res) continue
      const hit = res.pins.some(
        (p) =>
          p.connection === connectionId &&
          p.kind === kind &&
          p.entityId === entityId &&
          p.revision === revision
      )
      if (hit) ids.push(run.name)
    }
  }
  return ids.sort()
}

/** Set of pin keys currently referenced by any run. */
export function pinnedRevisionKeys(home: string): Set<string> {
  const keys = new Set<string>()
  for (const pin of collectAllPins(home)) {
    keys.add(pinKey(pin))
  }
  return keys
}
