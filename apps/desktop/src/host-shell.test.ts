import { describe, expect, it } from "vitest"
import { revealPathInFolder, setHostShell } from "./host-shell.ts"

describe("host-shell", () => {
  it("revealPathInFolder delegates to the active shell", () => {
    const calls: string[] = []
    setHostShell({
      showItemInFolder(fullPath) {
        calls.push(fullPath)
      },
    })
    revealPathInFolder("/tmp/shown")
    expect(calls).toEqual(["/tmp/shown"])
  })
})
