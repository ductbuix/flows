import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, vi } from "vitest"
import { describeFileWatcherContract } from "@workspace/core/testing/file-watcher.contract"
import { createFakeFileWatcher } from "@workspace/core/testing"
import type { FileWatcher } from "@workspace/core/ports"
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

/** Probe until fs.watch is delivering events (macOS can miss early writes). */
async function awaitWatcherReady(
  watcher: FileWatcher,
  touch: (path: string, content?: string) => void,
  settle: () => Promise<void>
): Promise<void> {
  const hits: string[] = []
  const sub = watcher.watch(["**/__ready__.probe"], (c) => hits.push(c.path))
  const deadline = Date.now() + 5000
  try {
    while (hits.length === 0) {
      if (Date.now() > deadline) {
        throw new Error("FileWatcher ready probe timed out")
      }
      touch("/__ready__.probe", String(Date.now()))
      await settle()
    }
  } finally {
    sub.dispose()
  }
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
        async ready() {},
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
      const debounceMs = 80
      const watcher = createNodeFileWatcher({ root, debounceMs })
      const touch = (path: string, content = "x") => {
        const abs = absFromStore(root, path)
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, content, "utf8")
      }
      const waitForDebounce = () =>
        new Promise<void>((resolve) => setTimeout(resolve, debounceMs + 40))
      return {
        watcher,
        touch,
        ready: () => awaitWatcherReady(watcher, touch, waitForDebounce),
        waitForDebounce,
      }
    },
  ],
])
