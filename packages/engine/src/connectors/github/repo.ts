import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import type { Connection } from "@workspace/shared"
import type { CommandResult } from "./run.ts"

export const PUSH_OP = "push_branch_draft_pr"

export type GithubPublishPayload = {
  branch: string
  repo: string
  remote: string
  baseSha: string
  headSha: string
  defaultBranch: string
  diff: string
  force: boolean
  workRepo: string
}

export function hostOf(connection: { scope: Record<string, string> }): string {
  return connection.scope.host?.trim() || "github.com"
}

export function remoteOf(
  connection: { scope: Record<string, string> },
  entityId: string
): string {
  const override = connection.scope.remote?.trim()
  if (override) return override
  const host = hostOf(connection)
  return `https://${host}/${entityId}.git`
}

export function repoEntityId(connection: Connection): string {
  const owner = connection.scope.owner?.trim()
  const name = connection.scope.name?.trim()
  if (!owner || !name) {
    throw new Error(`github connection ${connection.id} needs scope owner/name`)
  }
  return `${owner}/${name}`
}

export function publishBranch(runId: string, publishTaskId: string): string {
  return `flows/${runId}/${publishTaskId}`
}

/** First git repo under root (skips .git contents). */
export function findGitRepo(root: string): string | undefined {
  if (!existsSync(root)) return undefined
  if (existsSync(join(root, ".git"))) return root
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()!
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === ".git") continue
      const abs = join(dir, entry.name)
      if (existsSync(join(abs, ".git"))) return abs
      try {
        if (statSync(abs).isDirectory()) stack.push(abs)
      } catch {
        /* skip */
      }
    }
  }
  return undefined
}

export function parsePayload(raw: unknown): GithubPublishPayload | null {
  if (!raw || typeof raw !== "object") return null
  const p = raw as Record<string, unknown>
  if (
    typeof p.branch !== "string" ||
    typeof p.repo !== "string" ||
    typeof p.remote !== "string" ||
    typeof p.baseSha !== "string" ||
    typeof p.headSha !== "string" ||
    typeof p.defaultBranch !== "string" ||
    typeof p.diff !== "string" ||
    typeof p.force !== "boolean" ||
    typeof p.workRepo !== "string"
  ) {
    return null
  }
  return p as unknown as GithubPublishPayload
}

export async function ensureGitIdentity(
  repo: string,
  runGit: (args: string[]) => Promise<string>
): Promise<void> {
  const email = (
    await runGit(["-C", repo, "config", "--get", "user.email"]).catch(() => "")
  ).trim()
  if (!email) {
    await runGit(["-C", repo, "config", "user.email", "flows@localhost"])
    await runGit(["-C", repo, "config", "user.name", "Flows"])
  }
}

/** Remote tip for a branch, or undefined when missing. */
export async function remoteBranchTip(
  remote: string,
  branch: string,
  runGit: (args: string[]) => Promise<string>
): Promise<string | undefined> {
  try {
    const out = (
      await runGit(["ls-remote", remote, `refs/heads/${branch}`])
    ).trim()
    if (!out) return undefined
    const sha = out.split(/\s+/)[0]
    return sha && /^[0-9a-f]{7,40}$/i.test(sha) ? sha : undefined
  } catch {
    return undefined
  }
}

export async function isAncestor(
  repo: string,
  ancestor: string,
  tip: string,
  runGit: (args: string[]) => Promise<string>
): Promise<boolean> {
  try {
    await runGit(["-C", repo, "merge-base", "--is-ancestor", ancestor, tip])
    return true
  } catch {
    return false
  }
}

export async function defaultBranchName(
  remote: string,
  runGit: (args: string[]) => Promise<string>,
  runGh: (args: string[]) => Promise<CommandResult>,
  repo: string
): Promise<string> {
  try {
    const sym = (await runGit(["ls-remote", "--symref", remote, "HEAD"])).trim()
    const match = /ref:\s*refs\/heads\/(\S+)/.exec(sym)
    if (match?.[1]) return match[1]
  } catch {
    /* fall through */
  }
  const view = await runGh([
    "repo",
    "view",
    repo,
    "--json",
    "defaultBranchRef",
    "--jq",
    ".defaultBranchRef.name",
  ])
  const name = view.stdout.trim()
  if (name) return name
  return "main"
}
