import { useSyncExternalStore } from "react"
import { COLUMNS, type Column } from "./docket-data"

/** Board columns, shared by the board, New card and the card panel. */
let columns: Column[] = COLUMNS
const listeners = new Set<() => void>()

export const useColumns = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => columns
  )

export function saveColumns(next: Column[]) {
  columns = next
  listeners.forEach((fn) => fn())
}
