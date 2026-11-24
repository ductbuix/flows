import { shell as electronShell } from "electron"
import { appendFileSync } from "node:fs"

/** Finder reveal; injectable for smoke tests (BL-189). */
export type HostShell = {
  showItemInFolder(fullPath: string): void
}

function createDefaultShell(): HostShell {
  const stubLog = process.env.FLOWAPP_REVEAL_STUB
  if (stubLog) {
    return {
      showItemInFolder(fullPath: string) {
        appendFileSync(stubLog, `${fullPath}\n`)
      },
    }
  }
  return {
    showItemInFolder(fullPath: string) {
      electronShell.showItemInFolder(fullPath)
    },
  }
}

let active: HostShell | undefined

export function getHostShell(): HostShell {
  if (!active) active = createDefaultShell()
  return active
}

/** Tests and smoke inject a stub shell. */
export function setHostShell(next: HostShell): void {
  active = next
}

export function revealPathInFolder(fullPath: string): void {
  getHostShell().showItemInFolder(fullPath)
}
