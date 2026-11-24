import type {
  Disposable,
  FileWatchChange,
  FileWatcher,
} from "../ports/file-watcher.ts"
import { matchesAnyGlob, normPath } from "./match-glob.ts"

type Listener = {
  globs: readonly string[]
  onChange: (change: FileWatchChange) => void
}

export function createFakeFileWatcher(): FakeFileWatcher {
  return new FakeFileWatcher()
}

/** In-memory watcher; call `pulse` in tests to simulate a change. */
export class FakeFileWatcher implements FileWatcher {
  private readonly listeners = new Set<Listener>()
  private readonly pendingGen = new Map<string, number>()
  private flushQueued = false

  watch(
    globs: readonly string[],
    onChange: (change: FileWatchChange) => void
  ): Disposable {
    const listener: Listener = { globs, onChange }
    this.listeners.add(listener)
    return {
      dispose: () => {
        this.listeners.delete(listener)
      },
    }
  }

  /** Simulate a filesystem change at `path` (test-only). */
  pulse(path: string) {
    const key = normPath(path)
    this.pendingGen.set(key, (this.pendingGen.get(key) ?? 0) + 1)
    if (this.flushQueued) return
    this.flushQueued = true
    void Promise.resolve().then(() => {
      this.flushQueued = false
      const paths = [...this.pendingGen.keys()]
      for (const key of paths) {
        this.pendingGen.delete(key)
        this.emit(key)
      }
    })
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
