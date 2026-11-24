/**
 * Copy listed memory files into the step's `input/memory/` (DES-005).
 * Paths are store-relative to the workflow dir (e.g. `memory/style.md`).
 */
export function copyAgentMemories(
  docs: {
    read(path: string): { text: string } | null
    list(glob: string): string[]
    write(path: string, text: string): void
    remove(path: string): void
  },
  workflowDir: string,
  stepDir: string,
  memory: readonly string[] | undefined
): void {
  const destRoot = `${stepDir}/input/memory`
  for (const path of docs.list(`${destRoot}/**`)) {
    docs.remove(path)
  }
  if (!memory || memory.length === 0) return

  const root = workflowDir.replace(/\/$/, "")
  for (const rel of memory) {
    const clean = rel.replace(/^\.\//, "").replace(/^\/+/, "")
    if (clean.includes("..")) {
      throw new Error(`memory path escapes workflow dir: ${rel}`)
    }
    const src = `${root}/${clean}`
    const body = docs.read(src)
    if (!body) throw new Error(`memory file missing: ${rel}`)
    const name = clean.split("/").pop()!
    docs.write(`${destRoot}/${name}`, body.text)
  }
}
