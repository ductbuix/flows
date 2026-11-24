import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { Connection } from "../../connection-model.ts"
import { connectionDir } from "../../paths.ts"
import type {
  ConnectorChangeSet,
  ConnectorPublishContext,
  ConnectorPublishResult,
} from "../types.ts"
import type { GithubRunner } from "./run.ts"
import {
  PUSH_OP,
  findGitRepo,
  isAncestor,
  parsePayload,
  remoteBranchTip,
  type GithubPublishPayload,
} from "./repo.ts"

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

function fingerprintOf(changeSet: ConnectorChangeSet): string {
  return createHash("sha256")
    .update(JSON.stringify(changeSet))
    .digest("hex")
    .slice(0, 16)
}

function undoNote(branch: string, url: string): string {
  return [
    `Close the draft pull request (${url}), then delete the branch:`,
    `gh pr close --delete-branch`,
    `or: git push origin :refs/heads/${branch}`,
  ].join(" ")
}

function resolveWorkRepo(
  payload: GithubPublishPayload,
  connection: Connection,
  context?: ConnectorPublishContext
): string {
  if (payload.workRepo && existsSync(join(payload.workRepo, ".git"))) {
    return payload.workRepo
  }
  const root =
    context?.workCopyDir ??
    (context?.runRoot
      ? join(context.runRoot, "work", connection.id)
      : undefined)
  if (!root) {
    throw new Error("github publish needs the work copy path")
  }
  const found = findGitRepo(root)
  if (!found) throw new Error("github publish: no git repo in work copy")
  return found
}

async function createDraftPr(
  payload: GithubPublishPayload,
  runGh: GithubRunner["runGh"]
): Promise<{ url: string }> {
  const body =
    payload.diff.trim().slice(0, 60_000) ||
    `Flows publish of \`${payload.branch}\`.`
  const result = await runGh([
    "pr",
    "create",
    "--repo",
    payload.repo,
    "--draft",
    "--head",
    payload.branch,
    "--base",
    payload.defaultBranch,
    "--title",
    `flows: ${payload.branch}`,
    "--body",
    body,
  ])
  if (result.code !== 0) {
    const text = `${result.stdout}\n${result.stderr}`.trim()
    if (/already exists/i.test(text)) {
      const view = await runGh([
        "pr",
        "view",
        payload.branch,
        "--repo",
        payload.repo,
        "--json",
        "url",
        "--jq",
        ".url",
      ])
      const url = view.stdout.trim()
      if (url) return { url }
    }
    throw new Error(text || "gh pr create failed")
  }
  const url = result.stdout.trim().split("\n").filter(Boolean).at(-1) ?? ""
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`gh pr create did not return a URL: ${result.stdout}`)
  }
  return { url }
}

/**
 * Push the branch (git) and open a draft PR with `gh` (DES-026 / BL-050).
 */
export async function githubPublish(
  connection: Connection,
  changeSet: ConnectorChangeSet,
  home: string,
  runner: GithubRunner,
  context?: ConnectorPublishContext
): Promise<ConnectorPublishResult> {
  const { runGit, runGh } = runner
  const op = changeSet.ops.find((o) => o.op === PUSH_OP) ?? changeSet.ops[0]
  if (!op) {
    return { status: "rejected", message: "empty change set" }
  }
  const payload = parsePayload(op.payload)
  if (!payload) {
    return { status: "rejected", message: "invalid github publish payload" }
  }

  const fingerprint = fingerprintOf(changeSet)
  const receipt = receiptPath(home, connection.id, fingerprint)
  if (existsSync(receipt)) {
    return JSON.parse(readFileSync(receipt, "utf8")) as ConnectorPublishResult
  }

  const workRepo = resolveWorkRepo(payload, connection, context)
  const headSha = (await runGit(["-C", workRepo, "rev-parse", "HEAD"])).trim()
  if (headSha !== payload.headSha) {
    return {
      status: "rejected",
      message: `work copy HEAD ${headSha} != change set ${payload.headSha}`,
    }
  }

  const remoteTip = await remoteBranchTip(
    payload.remote,
    payload.branch,
    runGit
  )
  if (remoteTip && remoteTip !== headSha) {
    const canFf = await isAncestor(workRepo, remoteTip, headSha, runGit)
    if (!canFf && !payload.force) {
      return {
        status: "conflict",
        message: `branch ${payload.branch} has other commits`,
      }
    }
  }

  try {
    const pushRef = `HEAD:refs/heads/${payload.branch}`
    if (payload.force) {
      await runGit(["-C", workRepo, "push", "--force", payload.remote, pushRef])
    } else {
      await runGit(["-C", workRepo, "push", payload.remote, pushRef])
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "git push failed"
    if (/non-fast-forward|rejected/i.test(message) && !payload.force) {
      return {
        status: "conflict",
        message: `branch ${payload.branch} has other commits`,
      }
    }
    return { status: "rejected", message }
  }

  let url: string
  try {
    ;({ url } = await createDraftPr(payload, runGh))
  } catch (err) {
    return {
      status: "rejected",
      message: err instanceof Error ? err.message : "gh pr create failed",
    }
  }

  const outcome: ConnectorPublishResult = {
    status: "applied",
    result: { branch: payload.branch, url },
    undoNote: undoNote(payload.branch, url),
  }
  mkdirSync(join(connectionDir(home, connection.id), ".publish-receipts"), {
    recursive: true,
  })
  writeFileSync(receipt, JSON.stringify(outcome), "utf8")
  return outcome
}
