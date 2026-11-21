import { existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import type { ConnectionCheckResult } from "@workspace/shared"
import type {
  Connector,
  ConnectorChangeSet,
  ConnectorPublishResult,
  ConnectorPullResult,
} from "../types.ts"
import { runGh as defaultRunGh, runGit as defaultRunGit } from "./run.ts"
import type { CommandResult } from "./run.ts"

const SHARED_CLONE = ".clone"
const AMBIENT_GH = "command tasks can use the ambient gh login on this machine"

export type GithubRunner = {
  runGh: (args: string[]) => Promise<CommandResult>
  runGit: (args: string[]) => Promise<string>
}

function hostOf(connection: { scope: Record<string, string> }): string {
  return connection.scope.host?.trim() || "github.com"
}

function remoteOf(
  connection: { scope: Record<string, string> },
  entityId: string
): string {
  const override = connection.scope.remote?.trim()
  if (override) return override
  const host = hostOf(connection)
  return `https://${host}/${entityId}.git`
}

function parseAuthStatus(
  host: string,
  text: string,
  exitCode: number
): ConnectionCheckResult {
  if (/ENOENT|not found/i.test(text) || exitCode === 127) {
    return { ok: false, message: "GitHub CLI (gh) is missing" }
  }
  if (/Logged in to/i.test(text)) {
    return {
      ok: true,
      message: `signed in to ${host}`,
      ambientLogin: AMBIENT_GH,
    }
  }
  return { ok: false, message: `signed out of ${host}` }
}

async function ensureSharedClone(
  entityRoot: string,
  remote: string,
  runGit: GithubRunner["runGit"]
): Promise<string> {
  const cloneDir = join(entityRoot, SHARED_CLONE)
  mkdirSync(entityRoot, { recursive: true })
  if (!existsSync(cloneDir)) {
    await runGit(["clone", "--mirror", remote, cloneDir])
  } else {
    await runGit(["-C", cloneDir, "remote", "set-url", "origin", remote])
    await runGit([
      "-C",
      cloneDir,
      "fetch",
      "--prune",
      "origin",
      "+refs/*:refs/*",
    ])
  }
  await runGit(["-C", cloneDir, "config", "gc.auto", "0"])
  return cloneDir
}

/** Build a GitHub connector; tests inject runners. */
export function createGithubConnector(
  runner: GithubRunner = {
    runGh: defaultRunGh,
    runGit: defaultRunGit,
  }
): Connector {
  const { runGh, runGit } = runner
  return {
    id: "github",
    describe() {
      return {
        id: "github",
        entityKinds: ["repo"],
        scopeFields: ["owner", "name", "host", "remote"],
        signInMethods: ["cli"],
      }
    },
    async check(connection): Promise<ConnectionCheckResult> {
      const host = hostOf(connection)
      const result = await runGh(["auth", "status", "-h", host])
      return parseAuthStatus(
        host,
        `${result.stdout}\n${result.stderr}`,
        result.code
      )
    },
    async pull(input): Promise<ConnectorPullResult> {
      if (input.entityKind !== "repo") {
        throw new Error(
          `github connector only pulls repo, got ${input.entityKind}`
        )
      }
      const remote = remoteOf(input.connection, input.entityId)
      const cloneDir = await ensureSharedClone(input.entityRoot, remote, runGit)
      const sha = (await runGit(["-C", cloneDir, "rev-parse", "HEAD"])).trim()
      if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
        throw new Error(`invalid commit sha from clone: ${sha}`)
      }
      rmSync(input.destDir, { recursive: true, force: true })
      await runGit([
        "clone",
        "--shared",
        "--no-checkout",
        cloneDir,
        input.destDir,
      ])
      await runGit(["-C", input.destDir, "checkout", "--detach", sha])
      await runGit(["-C", input.destDir, "config", "gc.auto", "0"])
      return { revision: sha }
    },
    async diff(input): Promise<ConnectorChangeSet> {
      return {
        v: 1,
        connection: input.connection.id,
        base: "none",
        ops: [],
      }
    },
    async publish(): Promise<ConnectorPublishResult> {
      return {
        status: "rejected",
        message: "github publish is not implemented yet (BL-050)",
      }
    },
  }
}

export const githubConnector = createGithubConnector()

export { AMBIENT_GH, SHARED_CLONE }
