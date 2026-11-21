import { useEffect, useRef } from "react"
import { isEditorTypingTarget } from "./editor-typing"

type Hotkeys = {
  undo: () => void
  redo: () => void
  requestDelete: (taskId: string) => void
  selectedTaskId?: string
  taskCount: number
}

/** Undo/redo and Delete/Backspace when not typing (DES-022). */
export function useEditorHotkeys(keys: Hotkeys) {
  const ref = useRef(keys)
  ref.current = keys

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditorTypingTarget(e.target)) return
      const k = ref.current
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault()
        k.undo()
        return
      }
      if (
        (meta && e.key.toLowerCase() === "z" && e.shiftKey) ||
        (e.ctrlKey && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault()
        k.redo()
        return
      }
      if (e.key !== "Delete" && e.key !== "Backspace") return
      if (!k.selectedTaskId || k.taskCount <= 1) return
      e.preventDefault()
      k.requestDelete(k.selectedTaskId)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
