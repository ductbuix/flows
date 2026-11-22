import { createHash } from "node:crypto"
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
import { connectionDir } from "../paths.ts"
import { isSignedIn, readCookies } from "../secrets.ts"
import type {
  Connector,
  ConnectorChangeSet,
  ConnectorPublishResult,
} from "./types.ts"

function changeSetFingerprint(changeSet: ConnectorChangeSet): string {
  return createHash("sha256")
    .update(JSON.stringify(changeSet))
    .digest("hex")
    .slice(0, 16)
}

function receiptPath(
  home: string,
  connectionId: string,
  fingerprint: string
): string {
  return join(
    connectionDir(home, connectionId),
    ".publish-receipts",
    `${fingerprint}.json`
  )
}

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
 * Test-only connector. Cookie sign-in reads secrets only in check/pull/
 * publish; pull writes a small file; check/pull can fail when scope
 * flags are set. Diff compares work vs base (BL-042/043/048/053).
 */
export const fakeConnector: Connector = {
  id: "fake",
  describe() {
    return {
      id: "fake",
      entityKinds: ["item", "repo", "page"],
      scopeFields: [
        "label",
        "ambient",
        "domain",
        "url",
        "failPull",
        "signedOut",
      ],
      signInMethods: ["cli", "mcp", "cookies"],
    }
  },
  async check(connection, home): Promise<ConnectionCheckResult> {
    if (connection.scope.signedOut === "1") {
      return { ok: false, message: "fake signed out" }
    }
    if (connection.signIn === "cookies") {
      if (!isSignedIn(home, connection.id)) {
        return { ok: false, message: "not signed in" }
      }
      return { ok: true, message: "fake cookie sign-in ok" }
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
    if (input.connection.signIn === "cookies") {
      const cookies = readCookies(input.home, input.connection.id)
      if (!cookies || cookies.length === 0) {
        throw new Error("not signed in")
      }
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
  async publish(connection, changeSet, home): Promise<ConnectorPublishResult> {
    if (connection.signIn === "cookies") {
      const cookies = readCookies(home, connection.id)
      if (!cookies || cookies.length === 0) {
        return { status: "rejected", message: "not signed in" }
      }
    }

    const fingerprint = changeSetFingerprint(changeSet)
    const receipt = receiptPath(home, connection.id, fingerprint)
    if (existsSync(receipt)) {
      return JSON.parse(readFileSync(receipt, "utf8")) as ConnectorPublishResult
    }

    const mode = connection.scope.publishResult
    let outcome: ConnectorPublishResult
    if (mode === "conflict") {
      outcome = { status: "conflict", message: "fake conflict" }
    } else if (mode === "rejected") {
      outcome = {
        status: "rejected",
        message: connection.scope.publishMessage ?? "fake rejected",
      }
    } else {
      outcome = {
        status: "applied",
        result: {
          url: `https://example.test/${connection.id}/pr/${fingerprint}`,
          fingerprint,
        },
        undoNote: `Close the fake PR for ${connection.id} (${fingerprint})`,
      }
    }

    mkdirSync(join(connectionDir(home, connection.id), ".publish-receipts"), {
      recursive: true,
    })
    writeFileSync(receipt, JSON.stringify(outcome), "utf8")
    return outcome
  },
}
