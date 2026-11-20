import { existsSync, readFileSync, watch, type FSWatcher } from "node:fs"
import { basename, dirname, join } from "node:path"
import { workflowDir, type Engine } from "@workspace/engine"
import { hashContent } from "./hash.ts"

export type FileChange = {
  workflowId: string
  path: string
  hash: string
  content: string
}

/**
 * Watch open workflow dirs for workflow.yaml changes. Ignores hashes that
 * match the last server write for that path.
 */
export class WorkflowWatcher {
  private readonly watchers = new Map<string, FSWatcher>()
  private readonly lastWriteHash = new Map<string, string>()
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private readonly engine: Engine,
    private readonly onChange: (change: FileChange) => void
  ) {}

  noteWrite(workflowId: string, relativePath: string, hash: string) {
    this.lastWriteHash.set(`${workflowId}:${relativePath}`, hash)
  }

  watch(workflowId: string) {
    if (this.watchers.has(workflowId)) return
    const dir = workflowDir(this.engine.home, workflowId)
    if (!existsSync(dir)) return
    const watcher = watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return
      const rel = filename.toString().replaceAll("\\", "/")
      if (rel !== "workflow.yaml" && !rel.startsWith("memory/")) return
      this.schedule(workflowId, rel)
    })
    this.watchers.set(workflowId, watcher)
  }

  unwatch(workflowId: string) {
    const w = this.watchers.get(workflowId)
    if (!w) return
    w.close()
    this.watchers.delete(workflowId)
    const timer = this.timers.get(workflowId)
    if (timer) clearTimeout(timer)
    this.timers.delete(workflowId)
  }

  dispose() {
    for (const id of [...this.watchers.keys()]) this.unwatch(id)
  }

  private schedule(workflowId: string, relativePath: string) {
    const key = `${workflowId}:${relativePath}`
    const prev = this.timers.get(key)
    if (prev) clearTimeout(prev)
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key)
        this.emit(workflowId, relativePath)
      }, 50)
    )
  }

  private emit(workflowId: string, relativePath: string) {
    const abs = join(workflowDir(this.engine.home, workflowId), relativePath)
    if (!existsSync(abs)) return
    // Only notify for files still under the workflow dir.
    if (basename(dirname(abs)) === ".." ) return
    let content: string
    try {
      content = readFileSync(abs, "utf8")
    } catch {
      return
    }
    const hash = hashContent(content)
    const key = `${workflowId}:${relativePath}`
    if (this.lastWriteHash.get(key) === hash) return
    this.onChange({ workflowId, path: relativePath, hash, content })
  }
}
