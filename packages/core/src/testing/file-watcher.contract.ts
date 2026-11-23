import { beforeEach, describe, expect, it } from "vitest"
import type { FileWatcher } from "../ports/file-watcher.ts"

export type FileWatcherTestCtx = {
  watcher: FileWatcher
  touch(path: string, content?: string): void
  waitForDebounce(): Promise<void>
}

export type FileWatcherFactory = () => FileWatcherTestCtx

export function describeFileWatcherContract(
  title: string,
  factories: ReadonlyArray<readonly [string, FileWatcherFactory]>
): void {
  describe.each(factories)(`${title} (%s)`, (_label, create) => {
    let ctx: FileWatcherTestCtx

    beforeEach(() => {
      ctx = create()
    })

    it("notifies when a touched path matches a glob", async () => {
      const seen: string[] = []
      ctx.watcher.watch(["**/*.md"], (c) => seen.push(c.path))
      ctx.touch("/docs/a.md", "hello")
      await ctx.waitForDebounce()
      expect(seen).toEqual(["/docs/a.md"])
    })

    it("ignores paths that do not match globs", async () => {
      const seen: string[] = []
      ctx.watcher.watch(["**/*.md"], (c) => seen.push(c.path))
      ctx.touch("/docs/a.txt", "x")
      await ctx.waitForDebounce()
      expect(seen).toEqual([])
    })

    it("debounces rapid changes to one notification per path", async () => {
      let n = 0
      ctx.watcher.watch(["/x"], () => {
        n += 1
      })
      ctx.touch("/x", "1")
      ctx.touch("/x", "2")
      ctx.touch("/x", "3")
      await ctx.waitForDebounce()
      expect(n).toBe(1)
    })

    it("dispose stops further notifications", async () => {
      const seen: string[] = []
      const sub = ctx.watcher.watch(["/a", "/b"], (c) => seen.push(c.path))
      ctx.touch("/a", "1")
      await ctx.waitForDebounce()
      expect(seen).toEqual(["/a"])
      sub.dispose()
      ctx.touch("/b", "2")
      await ctx.waitForDebounce()
      expect(seen).toEqual(["/a"])
    })

    it("supports multiple globs on one subscription", async () => {
      const seen: string[] = []
      ctx.watcher.watch(["**/*.md", "workflow.yaml"], (c) => seen.push(c.path))
      ctx.touch("/workflow.yaml", "y")
      ctx.touch("/memory/x.txt", "t")
      ctx.touch("/memory/x.md", "m")
      await ctx.waitForDebounce()
      expect(seen).toContain("/workflow.yaml")
      expect(seen).toContain("/memory/x.md")
      expect(seen).not.toContain("/memory/x.txt")
    })
  })
}
