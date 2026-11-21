import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join, relative } from "node:path"
import type { ConnectionCheckResult } from "@workspace/shared"
import type {
  Connector,
  ConnectorChangeSet,
  ConnectorPublishResult,
} from "./types.ts"

function listFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "meta.json") continue
      const abs = join(dir, entry.name)
      // Follow resource pin symlinks (stat, not lstat).
      let st
      try {
        st = statSync(abs)
      } catch {
        continue
      }
      if (st.isDirectory()) walk(abs)
      else if (st.isFile()) out.push(relative(root, abs))
    }
  }
  walk(root)
  return out.sort()
}

function readText(root: string, rel: string): string | undefined {
  const path = join(root, rel)
  try {
    if (!statSync(path).isFile()) return undefined
  } catch {
    return undefined
  }
  return readFileSync(path, "utf8")
}

/**
 * Test-only connector. Pull writes a small file; check/pull can fail when
 * scope flags are set. Diff compares work vs base (BL-042 / BL-043 / BL-048).
 */
export const fakeConnector: Connector = {
  id: "fake",
  describe() {
    return {
      id: "fake",
      entityKinds: ["item"],
      scopeFields: ["label", "ambient", "failPull", "signedOut"],
      signInMethods: ["cli", "mcp", "cookies"],
    }
  },
  async check(connection): Promise<ConnectionCheckResult> {
    if (connection.scope.signedOut === "1") {
      return { ok: false, message: "fake signed out" }
    }
    const ambient = connection.scope.ambient
    if (ambient) {
      return {
        ok: true,
        message: "fake sign-in ok",
        ambientLogin: ambient,
      }
    }
    return { ok: true, message: "fake sign-in ok" }
  },
  async pull(input) {
    if (input.connection.scope.signedOut === "1") {
      throw new Error("signed out")
    }
    const fail = input.connection.scope.failPull
    if (fail) throw new Error(fail)
    mkdirSync(input.destDir, { recursive: true })
    const body = input.connection.scope.label ?? input.entityId
    writeFileSync(join(input.destDir, "data.txt"), body, "utf8")
    return {}
  },
  async diff(input): Promise<ConnectorChangeSet> {
    const workFiles = new Set(listFiles(input.workCopyDir))
    const baseFiles = new Set(listFiles(input.baseDir))
    const ops: ConnectorChangeSet["ops"] = []
    const all = new Set([...workFiles, ...baseFiles])

    for (const rel of [...all].sort()) {
      const work = readText(input.workCopyDir, rel)
      const base = readText(input.baseDir, rel)
      if (work === base) continue
      if (work !== undefined && base === undefined) {
        const destructive =
          rel.endsWith(".destructive") ||
          rel === "DELETE" ||
          work.includes("__destructive__")
        ops.push({
          op: "add",
          target: rel,
          summary: `add ${rel}`,
          destructive,
          payload: { text: work },
        })
      } else if (work === undefined && base !== undefined) {
        ops.push({
          op: "delete",
          target: rel,
          summary: `delete ${rel}`,
          destructive: true,
          payload: { text: base },
        })
      } else {
        const destructive =
          rel.endsWith(".destructive") ||
          (work?.includes("__destructive__") ?? false)
        ops.push({
          op: "edit",
          target: rel,
          summary: `edit ${rel}`,
          destructive,
          payload: { before: base, after: work },
        })
      }
    }

    return {
      v: 1,
      connection: input.connection.id,
      base: existsSync(input.baseDir) ? "pinned" : "none",
      ops,
    }
  },
  async publish(): Promise<ConnectorPublishResult> {
    return { status: "rejected", message: "fake publish is not implemented" }
  },
}
