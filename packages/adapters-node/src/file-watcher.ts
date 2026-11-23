import { watch, type FSWatcher } from "node:fs"
import { basename, join, relative } from "node:path"
import { minimatch } from "minimatch"
import type {
  Disposable,
  FileWatchChange,
  FileWatcher,
} from "@workspace/core/ports"

type Listener = {
  globs: readonly string[]
  onChange: (change: FileWatchChange) => void
}

function toStorePath(root: string, abs: string): string {
  return `/${relative(root, abs).split("\\").join("/")}`
}

function matchesAnyGlob(globs: readonly string[], path: string): boolean {
  const p = path.replace(/^\//, "")
  return globs.some((g) => minimatch(p, g.replace(/^\//, "")))
}

export function createNodeFileWatcher(options: {
  root: string
  debounceMs?: number
}): FileWatcher {
  return new NodeFileWatcher(options.root, options.debounceMs ?? 50)
}

class NodeFileWatcher implements FileWatcher {
  private readonly listeners = new Set<Listener>()
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private fsWatcher: FSWatcher | undefined

  constructor(
    private readonly root: string,
    private readonly debounceMs: number
  ) {}

  watch(
    globs: readonly string[],
    onChange: (change: FileWatchChange) => void
  ): Disposable {
    const listener: Listener = { globs, onChange }
    this.listeners.add(listener)
    this.ensureWatching()
    return {
      dispose: () => {
        this.listeners.delete(listener)
        if (this.listeners.size === 0) this.stopWatching()
      },
    }
  }

  private ensureWatching() {
    if (this.fsWatcher) return
    this.fsWatcher = watch(this.root, { recursive: true }, (_evt, filename) => {
      if (!filename) return
      let rel = filename.toString().replaceAll("\\", "/")
      if (rel.startsWith(this.root)) {
        rel = rel.slice(this.root.length).replace(/^\//, "")
      }
      if (!rel || rel === basename(this.root)) return
      const abs = join(this.root, rel)
      const relToRoot = relative(this.root, abs)
      if (relToRoot.startsWith("..")) return
      const path = toStorePath(this.root, abs)
      this.schedule(path)
    })
  }

  private stopWatching() {
    this.fsWatcher?.close()
    this.fsWatcher = undefined
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
  }

  private schedule(path: string) {
    const prev = this.timers.get(path)
    if (prev) clearTimeout(prev)
    this.timers.set(
      path,
      setTimeout(() => {
        this.timers.delete(path)
        this.emit(path)
      }, this.debounceMs)
    )
  }

  private emit(path: string) {
    const change: FileWatchChange = { path }
    for (const listener of this.listeners) {
      if (matchesAnyGlob(listener.globs, path)) {
        listener.onChange(change)
      }
    }
  }
}
