import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { connectionSchema } from "../../connection-model.ts"
import { pullEntity, resolveScopeEntity } from "../../library.ts"
import { libraryEntityDir } from "../../paths.ts"
import { clearConnectors, registerConnector } from "../registry.ts"
import {
  AMBIENT_GH,
  SHARED_CLONE,
  createGithubConnector,
  githubConnector,
} from "./index.ts"
import { runGit } from "./run.ts"

const live = process.env.FLOWAPP_LIVE_GH === "1"
const dirs: string[] = []

afterEach(() => {
  clearConnectors()
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

beforeEach(() => {
  registerConnector(githubConnector)
})

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

async function makeBareRepo(): Promise<{ bare: string; sha: string }> {
  const root = tempDir("flowapp-gh-src-")
  const work = join(root, "work")
  const bare = join(root, "remote.git")
  await runGit(["init", "-b", "main", work])
  writeFileSync(join(work, "README.md"), "hello from bare\n", "utf8")
  await runGit(["-C", work, "add", "README.md"])
  await runGit(["-C", work, "config", "user.email", "test@example.com"])
  await runGit(["-C", work, "config", "user.name", "Test"])
  await runGit(["-C", work, "commit", "-m", "init"])
  const sha = (await runGit(["-C", work, "rev-parse", "HEAD"])).trim()
  await runGit(["clone", "--bare", work, bare])
  return { bare, sha }
}

describe("github connector", () => {
  it("describe lists repo and cli sign-in", () => {
    const desc = githubConnector.describe()
    expect(desc.id).toBe("github")
    expect(desc.entityKinds).toEqual(["repo"])
    expect(desc.scopeFields).toContain("owner")
    expect(desc.scopeFields).toContain("name")
    expect(desc.signInMethods).toEqual(["cli"])
  })

  it("resolveScopeEntity builds owner/name", () => {
    const connection = connectionSchema.parse({
      id: "github-acme",
      connector: "github",
      name: "Acme API",
      scope: {
        owner: "acme",
        name: "api",
        host: "github.com",
        remote: "/tmp/unused",
      },
      signIn: "cli",
      refresh: "1h",
    })
    expect(resolveScopeEntity(connection)).toEqual({
      kind: "repo",
      entityId: "acme/api",
      title: "Acme API",
    })
  })

  it("check reports signed in, signed out, or missing CLI", async () => {
    const signedIn = createGithubConnector({
      runGh: async () => ({
        stdout: "",
        stderr: "Logged in to github.com account someone",
        code: 0,
      }),
      runGit: runGit,
    })
    expect(
      await signedIn.check(
        {
          id: "c",
          connector: "github",
          name: "c",
          scope: {},
          signIn: "cli",
          refresh: "1h",
          policy: "read-only",
          serial: false,
        },
        "/tmp"
      )
    ).toEqual({
      ok: true,
      message: "signed in to github.com",
      ambientLogin: AMBIENT_GH,
    })

    const signedOut = createGithubConnector({
      runGh: async () => ({
        stdout: "",
        stderr: "You are not logged into any GitHub hosts",
        code: 1,
      }),
      runGit: runGit,
    })
    expect(
      await signedOut.check(
        {
          id: "c",
          connector: "github",
          name: "c",
          scope: { host: "github.com" },
          signIn: "cli",
          refresh: "1h",
          policy: "read-only",
          serial: false,
        },
        "/tmp"
      )
    ).toEqual({ ok: false, message: "signed out of github.com" })

    const missing = createGithubConnector({
      runGh: async () => ({
        stdout: "",
        stderr: "ENOENT: gh not found",
        code: 127,
      }),
      runGit: runGit,
    })
    expect(
      await missing.check(
        {
          id: "c",
          connector: "github",
          name: "c",
          scope: {},
          signIn: "cli",
          refresh: "1h",
          policy: "read-only",
          serial: false,
        },
        "/tmp"
      )
    ).toEqual({ ok: false, message: "GitHub CLI (gh) is missing" })
  })

  it("pull keeps one shared clone and pins a detached commit checkout", async () => {
    const { bare, sha } = await makeBareRepo()
    const connector = createGithubConnector({
      runGh: async () => ({
        stdout: "",
        stderr: "Logged in to github.com account test",
        code: 0,
      }),
      runGit,
    })
    registerConnector(connector)

    const home = tempDir("flowapp-gh-pull-")
    const connection = connectionSchema.parse({
      id: "github-demo",
      connector: "github",
      name: "Demo",
      scope: { owner: "acme", name: "demo", remote: bare },
      signIn: "cli",
      refresh: "never",
    })

    const first = await pullEntity({
      home,
      connection,
      kind: "repo",
      entityId: "acme/demo",
      force: true,
    })
    expect(first.revision).toBe(sha)
    const entityRoot = libraryEntityDir(
      home,
      "github-demo",
      "repo",
      "acme/demo"
    )
    expect(existsSync(join(entityRoot, SHARED_CLONE))).toBe(true)
    expect(readlinkSync(join(entityRoot, "current"))).toBe(sha)
    expect(readFileSync(join(entityRoot, sha, "README.md"), "utf8")).toContain(
      "hello from bare"
    )
    const head = (
      await runGit(["-C", join(entityRoot, sha), "rev-parse", "HEAD"])
    ).trim()
    expect(head).toBe(sha)

    const second = await pullEntity({
      home,
      connection,
      kind: "repo",
      entityId: "acme/demo",
      force: true,
    })
    expect(second.revision).toBe(sha)
    expect(existsSync(join(entityRoot, SHARED_CLONE))).toBe(true)
  })
})

describe.skipIf(!live)("live github (FLOWAPP_LIVE_GH=1)", () => {
  it("check uses real gh auth status", async () => {
    const result = await githubConnector.check(
      {
        id: "live",
        connector: "github",
        name: "live",
        scope: {},
        signIn: "cli",
        refresh: "1h",
        policy: "read-only",
        serial: false,
      },
      "/tmp"
    )
    expect(result.ok || /signed out|missing/i.test(result.message)).toBe(true)
    if (result.ok) expect(result.ambientLogin).toBe(AMBIENT_GH)
  })
})
