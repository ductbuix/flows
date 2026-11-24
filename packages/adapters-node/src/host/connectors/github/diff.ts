import type { ConnectorChangeSet, ConnectorDiffInput } from "../types.ts"
import {
  PUSH_OP,
  defaultBranchName,
  ensureGitIdentity,
  findGitRepo,
  isAncestor,
  publishBranch,
  remoteBranchTip,
  remoteOf,
  repoEntityId,
  type GithubPublishPayload,
} from "./repo.ts"
import type { GithubRunner } from "./run.ts"

/**
 * Commit dirty work, then one op: push branch flows/<runId>/<taskId>
 * and open a draft PR (DES-026 / BL-050).
 */
export async function githubDiff(
  input: ConnectorDiffInput,
  runner: GithubRunner
): Promise<ConnectorChangeSet> {
  const { runGit, runGh } = runner
  const workRepo = findGitRepo(input.workCopyDir)
  if (!workRepo) {
    return {
      v: 1,
      connection: input.connection.id,
      base: "none",
      ops: [],
    }
  }

  const baseRepo = findGitRepo(input.baseDir)
  const baseSha = baseRepo
    ? (await runGit(["-C", baseRepo, "rev-parse", "HEAD"])).trim()
    : (await runGit(["-C", workRepo, "rev-list", "--max-parents=0", "HEAD"]))
        .trim()
        .split("\n")[0]!

  await ensureGitIdentity(workRepo, runGit)
  const dirty = (await runGit(["-C", workRepo, "status", "--porcelain"])).trim()
  if (dirty) {
    await runGit(["-C", workRepo, "add", "-A"])
    await runGit(["-C", workRepo, "commit", "-m", "flows: publish changes"])
  }

  const headSha = (await runGit(["-C", workRepo, "rev-parse", "HEAD"])).trim()
  if (headSha === baseSha) {
    return {
      v: 1,
      connection: input.connection.id,
      base: baseSha,
      ops: [],
    }
  }

  const unified = await runGit([
    "-C",
    workRepo,
    "diff",
    "--binary",
    `${baseSha}...${headSha}`,
  ])

  const runId = input.runId?.trim() || "local"
  const taskId = input.publishTaskId?.trim() || "local"
  const branch = publishBranch(runId, taskId)
  const entityId = repoEntityId(input.connection)
  const remote = remoteOf(input.connection, entityId)
  const defaultBranch = await defaultBranchName(remote, runGit, runGh, entityId)

  const remoteTip = await remoteBranchTip(remote, branch, runGit)
  let force = false
  if (remoteTip && remoteTip !== headSha) {
    const canFf = await isAncestor(workRepo, remoteTip, headSha, runGit)
    if (!canFf) {
      // Diverged / other commits → conflict at publish. Force only when
      // the remote tip is still in this repo but not an ancestor (rewrite).
      const remoteKnown = await runGit([
        "-C",
        workRepo,
        "cat-file",
        "-t",
        remoteTip,
      ])
        .then((t) => t.trim() === "commit")
        .catch(() => false)
      force = remoteKnown
    }
  }

  const payload: GithubPublishPayload = {
    branch,
    repo: entityId,
    remote,
    baseSha,
    headSha,
    defaultBranch,
    diff: unified,
    force,
    workRepo,
  }

  return {
    v: 1,
    connection: input.connection.id,
    base: baseSha,
    ops: [
      {
        op: PUSH_OP,
        target: branch,
        summary: `Push branch ${branch} and open a draft pull request`,
        destructive: force,
        payload,
      },
    ],
  }
}
