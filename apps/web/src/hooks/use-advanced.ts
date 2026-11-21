import { useEffect, useState } from "react"

export const ADVANCED_STORAGE_KEY = "flows-advanced"
const ADVANCED_EVENT = "flows-advanced-change"

function readAdvanced(): boolean {
  try {
    return localStorage.getItem(ADVANCED_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

/** Shared Advanced disclosure (`flows-advanced` in localStorage). Off by default. */
export function useAdvanced() {
  const [advanced, setAdvancedState] = useState(false)

  useEffect(() => {
    setAdvancedState(readAdvanced())
    function sync() {
      setAdvancedState(readAdvanced())
    }
    function onStorage(e: StorageEvent) {
      if (e.key === ADVANCED_STORAGE_KEY || e.key === null) sync()
    }
    window.addEventListener(ADVANCED_EVENT, sync)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(ADVANCED_EVENT, sync)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  function setAdvanced(next: boolean) {
    try {
      localStorage.setItem(ADVANCED_STORAGE_KEY, next ? "1" : "0")
    } catch {
      /* ignore quota / private mode */
    }
    setAdvancedState(next)
    window.dispatchEvent(new Event(ADVANCED_EVENT))
  }

  return { advanced, setAdvanced }
}
