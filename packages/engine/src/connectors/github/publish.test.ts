import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import type { Connection } from "../../connection-model.ts"
import { connectionSchema } from "../../connection-model.ts"
import { pullEntity } from "../../library.ts"
import { libraryEntityDir } from "../../paths.ts"
import { copyPinnedEntity, workEntityDir } from "../../work-copy.ts"
import { clearConnectors, registerConnector } from "../registry.ts"
import { createGithubConnector } from "./index.ts"
import { PUSH_OP } from "./repo.ts"
import { runGit, type CommandResult } from "./run.ts"

const live = process.env.FLOWAPP_LIVE_GH === "1"
const dirs: string[] = []

afterEach(() => {
  clearConnectors()
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

async function gitIdent(dir: string): Promise<void> {
  await runGit(["-C", dir, "config", "user.email", "test@example.com"])
  await runGit(["-C", dir, "config", "user.name", "Test"])
}

async function makeBareRepo(): Promise<{ bare: string }> {
  const root = tempDir("flowapp-gh-pub-src-")
  const work = join(root, "work")
  const bare = join(root, "remote.git")
  await runGit(["init", "-b", "main", work])
  writeFileSync(join(work, "README.md"), "hello from bare\n", "utf8")
  await runGit(["-C", work, "add", "README.md"])
  await gitIdent(work)
  await runGit(["-C", work, "commit", "-m", "init"])
  await runGit(["clone", "--bare", work, bare])
  return { bare }
}

function stubGh(prUrl = "https://github.com/acme/demo/pull/1") {
  return async (args: string[]): Promise<CommandResult> => {
    if (args[0] === "auth") {
      return {
        stdout: "",
        stderr: "Logged in to github.com account test",
        code: 0,
      }
    }
    if (args[0] === "pr" && args[1] === "create") {
      return { stdout: `${prUrl}\n`, stderr: "", code: 0 }
    }
    if (args[0] === "repo" && args[1] === "view") {
      return { stdout: "main\n", stderr: "", code: 0 }
    }
    return { stdout: "", stderr: `unexpected gh ${args.join(" ")}`, code: 1 }
  }
}

function demoConn(bare: string): Connection {
  return {
    id: "github-demo",
    connector: "github",
    name: "Demo",
    scope: { owner: "acme", name: "demo", remote: bare },
    signIn: "cli",
    refresh: "never",
    policy: "approve-each-publish",
    serial: false,
  }
}

async function prepWorkCopy(bare: string, home: string) {
  registerConnector(createGithubConnector({ runGh: stubGh(), runGit }))
  const connection = connectionSchema.parse({
    id: "github-demo",
    connector: "github",
    name: "Demo",
    scope: { owner: "acme", name: "demo", remote: bare },
    signIn: "cli",
    refresh: "never",
    policy: "approve-each-publish",
  })

  const pulled = await pullEntity({
    home,
    connection,
    kind: "repo",
    entityId: "acme/demo",
    force: true,
  })
  const pin = join(
    libraryEntityDir(home, "github-demo", "repo", "acme/demo"),
    pulled.revision
  )
  const runRoot = join(home, "workflows", "wf", "runs", "run-1")
  const workRepo = workEntityDir(runRoot, "github-demo", "repo", "acme/demo")
  copyPinnedEntity(pin, workRepo)
  const baseDir = join(runRoot, "resources", "github-demo")
  mkdirSync(join(baseDir, "repo"), { recursive: true })
  copyPinnedEntity(pin, join(baseDir, "repo", "acme%2Fdemo"))
  return {
    workRepo,
    baseDir,
    runRoot,
    workCopyDir: join(runRoot, "work", "github-demo"),
  }
}

describe("github publish (BL-050)", () => {
  it("diff commits dirty work and builds one draft-PR op", async () => {
    const { bare } = await makeBareRepo()
    const home = tempDir("flowapp-gh-diff-")
    const { workRepo, baseDir, workCopyDir } = await prepWorkCopy(bare, home)
    const connector = createGithubConnector({ runGh: stubGh(), runGit })

    writeFileSync(join(workRepo, "feature.txt"), "new work\n", "utf8")
    const changeSet = await connector.diff({
      connection: demoConn(bare),
      workCopyDir,
      baseDir,
      runId: "run-1",
      publishTaskId: "open-pr",
    })

    expect(changeSet.ops).toHaveLength(1)
    const op = changeSet.ops[0]!
    expect(op.op).toBe(PUSH_OP)
    expect(op.target).toBe("flows/run-1/open-pr")
    expect(op.destructive).toBe(false)
    const payload = op.payload as { diff: string; force: boolean }
    expect(payload.force).toBe(false)
    expect(payload.diff).toMatch(/feature\.txt/)
    expect(await runGit(["-C", workRepo, "log", "--oneline", "-1"])).toMatch(
      /flows: publish changes/
    )
  })

  it("publish pushes branch, opens draft PR, returns undo note", async () => {
    const { bare } = await makeBareRepo()
    const home = tempDir("flowapp-gh-apply-")
    const { workRepo, baseDir, runRoot, workCopyDir } = await prepWorkCopy(
      bare,
      home
    )
    const prUrl = "https://github.com/acme/demo/pull/42"
    const connector = createGithubConnector({ runGh: stubGh(prUrl), runGit })
    const conn = demoConn(bare)

    writeFileSync(join(workRepo, "feature.txt"), "ship it\n", "utf8")
    const changeSet = await connector.diff({
      connection: conn,
      workCopyDir,
      baseDir,
      runId: "run-1",
      publishTaskId: "open-pr",
    })
    const outcome = await connector.publish(conn, changeSet, home, { runRoot })
    expect(outcome.status).toBe("applied")
    if (outcome.status !== "applied") return
    expect(outcome.result).toEqual({
      branch: "flows/run-1/open-pr",
      url: prUrl,
    })
    expect(outcome.undoNote).toMatch(/Close the draft pull request/)
    expect(outcome.undoNote).toMatch(/flows\/run-1\/open-pr/)
    expect(
      (
        await runGit(["ls-remote", bare, "refs/heads/flows/run-1/open-pr"])
      ).trim()
    ).toMatch(/^[0-9a-f]+/)
  })

  it("remote branch with other commits is conflict; moved default is not", async () => {
    const { bare } = await makeBareRepo()
    const home = tempDir("flowapp-gh-conflict-")
    const { workRepo, baseDir, runRoot, workCopyDir } = await prepWorkCopy(
      bare,
      home
    )
    const connector = createGithubConnector({ runGh: stubGh(), runGit })
    const conn = demoConn(bare)

    const other = join(tempDir("flowapp-gh-main-"), "checkout")
    await runGit(["clone", bare, other])
    await gitIdent(other)
    writeFileSync(join(other, "README.md"), "moved main\n", "utf8")
    await runGit(["-C", other, "add", "README.md"])
    await runGit(["-C", other, "commit", "-m", "move main"])
    await runGit(["-C", other, "push", "origin", "main"])

    writeFileSync(join(workRepo, "feature.txt"), "ok with moved main\n", "utf8")
    const okSet = await connector.diff({
      connection: conn,
      workCopyDir,
      baseDir,
      runId: "run-1",
      publishTaskId: "open-pr",
    })
    expect(
      (await connector.publish(conn, okSet, home, { runRoot })).status
    ).toBe("applied")

    const clash = join(tempDir("flowapp-gh-clash-"), "checkout")
    await runGit(["clone", bare, clash])
    await gitIdent(clash)
    await runGit(["-C", clash, "checkout", "-b", "flows/run-2/open-pr"])
    writeFileSync(join(clash, "other.txt"), "someone else\n", "utf8")
    await runGit(["-C", clash, "add", "other.txt"])
    await runGit(["-C", clash, "commit", "-m", "other commits"])
    await runGit(["-C", clash, "push", "-u", "origin", "flows/run-2/open-pr"])

    writeFileSync(join(workRepo, "more.txt"), "our side\n", "utf8")
    const clashSet = await connector.diff({
      connection: conn,
      workCopyDir,
      baseDir,
      runId: "run-2",
      publishTaskId: "open-pr",
    })
    const conflicted = await connector.publish(conn, clashSet, home, {
      runRoot,
    })
    expect(conflicted.status).toBe("conflict")
    if (conflicted.status === "conflict") {
      expect(conflicted.message).toMatch(/other commits/)
    }
  })

  it("force push is flagged destructive", async () => {
    const { bare } = await makeBareRepo()
    const home = tempDir("flowapp-gh-force-")
    const { workRepo, baseDir, runRoot, workCopyDir } = await prepWorkCopy(
      bare,
      home
    )
    const connector = createGithubConnector({ runGh: stubGh(), runGit })
    const conn = demoConn(bare)

    writeFileSync(join(workRepo, "a.txt"), "first\n", "utf8")
    const first = await connector.diff({
      connection: conn,
      workCopyDir,
      baseDir,
      runId: "run-f",
      publishTaskId: "ship",
    })
    expect(
      (await connector.publish(conn, first, home, { runRoot })).status
    ).toBe("applied")

    await runGit(["-C", workRepo, "commit", "--amend", "-m", "amended publish"])
    writeFileSync(join(workRepo, "a.txt"), "rewritten\n", "utf8")
    await runGit(["-C", workRepo, "add", "a.txt"])
    await runGit(["-C", workRepo, "commit", "--amend", "--no-edit"])

    const forced = await connector.diff({
      connection: conn,
      workCopyDir,
      baseDir,
      runId: "run-f",
      publishTaskId: "ship",
    })
    expect(forced.ops[0]?.destructive).toBe(true)
    expect((forced.ops[0]?.payload as { force: boolean }).force).toBe(true)
    expect(
      (await connector.publish(conn, forced, home, { runRoot })).status
    ).toBe("applied")
  })
})

describe.skipIf(!live)("live github publish (FLOWAPP_LIVE_GH=1)", () => {
  it("auth check still works when live flag is set", async () => {
    const connector = createGithubConnector()
    const result = await connector.check(demoConn("unused"), "/tmp")
    expect(result.ok || /signed out|missing/i.test(result.message)).toBe(true)
  })
})
