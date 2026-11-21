import type { RunSummary } from "@workspace/shared"

export const AD_HOC_LABEL = "Ad hoc"

export type RunItemGroup = {
  /** Stable group id: workItemId, or AD_HOC_LABEL when none. */
  key: string
  /** Work item title, or "Ad hoc". */
  label: string
  runs: RunSummary[]
}

type TitleLookup = ReadonlyMap<string, string> | Record<string, string>

function titleFor(id: string, titles: TitleLookup): string {
  if (titles instanceof Map) return titles.get(id) ?? id
  return titles[id] ?? id
}

/** Group runs by work item title; missing workItemId goes under "Ad hoc" (BL-041). */
export function groupRunsByItem(
  runs: RunSummary[],
  titles: TitleLookup = {}
): RunItemGroup[] {
  const map = new Map<string, RunSummary[]>()
  for (const run of runs) {
    const key = run.workItemId ?? AD_HOC_LABEL
    const list = map.get(key)
    if (list) list.push(run)
    else map.set(key, [run])
  }

  const keys = [...map.keys()].sort((a, b) => {
    if (a === AD_HOC_LABEL) return 1
    if (b === AD_HOC_LABEL) return -1
    return titleFor(a, titles).localeCompare(titleFor(b, titles))
  })

  return keys.map((key) => ({
    key,
    label: key === AD_HOC_LABEL ? AD_HOC_LABEL : titleFor(key, titles),
    runs: map.get(key)!,
  }))
}
