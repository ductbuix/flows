import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, vi } from "vitest"
import { describeFileWatcherContract } from "@workspace/core/testing/file-watcher.contract"
import { createFakeFileWatcher } from "@workspace/core/testing"
import { createNodeFileWatcher } from "./file-watcher.ts"

const temps: string[] = []

afterEach(() => {
  vi.useRealTimers()
  while (temps.length > 0) {
    rmSync(temps.pop()!, { recursive: true, force: true })
  }
})

function absFromStore(root: string, storePath: string): string {
  return join(root, storePath.replace(/^\//, ""))
}

describeFileWatcherContract("FileWatcher", [
  [
    "fake",
    () => {
      const fake = createFakeFileWatcher()
      return {
        watcher: fake,
        touch(path: string) {
          fake.pulse(path)
        },
        async waitForDebounce() {
          await Promise.resolve()
        },
      }
    },
  ],
  [
    "node",
    () => {
      vi.useRealTimers()
      const root = mkdtempSync(join(tmpdir(), "flowapp-fswatch-"))
      temps.push(root)
      return {
        watcher: createNodeFileWatcher({ root, debounceMs: 80 }),
        touch(path: string, content = "x") {
          const abs = absFromStore(root, path)
          mkdirSync(dirname(abs), { recursive: true })
          writeFileSync(abs, content, "utf8")
        },
        waitForDebounce() {
          return new Promise<void>((resolve) => setTimeout(resolve, 200))
        },
      }
    },
  ],
])
