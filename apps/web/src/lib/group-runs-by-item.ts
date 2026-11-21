import type { RunSummary } from "@workspace/shared"

export const NO_ITEM_KEY = "No item"

export type RunItemGroup = {
  key: string
  runs: RunSummary[]
}

/** Group runs by itemKey; missing keys go under "No item" (BL-034). */
export function groupRunsByItem(runs: RunSummary[]): RunItemGroup[] {
  const map = new Map<string, RunSummary[]>()
  for (const run of runs) {
    const key = run.itemKey ?? NO_ITEM_KEY
    const list = map.get(key)
    if (list) list.push(run)
    else map.set(key, [run])
  }

  const keys = [...map.keys()].sort((a, b) => {
    if (a === NO_ITEM_KEY) return 1
    if (b === NO_ITEM_KEY) return -1
    return a.localeCompare(b)
  })

  return keys.map((key) => ({ key, runs: map.get(key)! }))
}
