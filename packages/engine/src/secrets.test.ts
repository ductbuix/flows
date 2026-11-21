import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  clearConnectors,
  fakeConnector,
  registerConnector,
} from "./connectors/index.ts"
import { createConnection } from "./connections.ts"
import { secretsDir, secretsRoot } from "./paths.ts"
import {
  cookiesPath,
  isSignedIn,
  readCookies,
  removeSignIn,
  writeCookies,
} from "./secrets.ts"

const dirs: string[] = []

beforeEach(() => {
  registerConnector(fakeConnector)
})

afterEach(() => {
  clearConnectors()
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-secrets-"))
  dirs.push(home)
  return home
}

describe("cookie store", () => {
  it("writes cookies.json as 0600 under 0700 folders", () => {
    const home = tempHome()
    writeCookies(home, "rally-payments", [
      {
        name: "ZSESSIONID",
        value: "secret-value",
        domain: "rally1.rallydev.com",
        path: "/",
      },
    ])
    const path = cookiesPath(home, "rally-payments")
    expect(statSync(secretsRoot(home)).mode & 0o777).toBe(0o700)
    expect(statSync(secretsDir(home, "rally-payments")).mode & 0o777).toBe(
      0o700
    )
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(readCookies(home, "rally-payments")?.[0]?.value).toBe("secret-value")
    expect(isSignedIn(home, "rally-payments")).toBe(true)
  })

  it("removeSignIn deletes secrets/<id>/ and keeps library data", () => {
    const home = tempHome()
    writeCookies(home, "rally-payments", [
      {
        name: "ZSESSIONID",
        value: "secret-value",
        domain: "example.com",
        path: "/",
      },
    ])
    const libraryFile = join(
      home,
      "library",
      "rally-payments",
      "item",
      "1",
      "current",
      "item.json"
    )
    mkdirSync(dirname(libraryFile), { recursive: true })
    writeFileSync(libraryFile, '{"id":"1"}\n')

    removeSignIn(home, "rally-payments")
    expect(existsSync(secretsDir(home, "rally-payments"))).toBe(false)
    expect(isSignedIn(home, "rally-payments")).toBe(false)
    expect(readFileSync(libraryFile, "utf8")).toContain('"id":"1"')
  })
})

describe("cookie leak scan after pull", () => {
  it("finds no cookie value outside secrets/ or in pull output", async () => {
    const home = tempHome()
    const secretValue = "cookie-leak-probe-value-9f3a"
    const created = createConnection(home, {
      id: "rally-payments",
      connector: "fake",
      name: "Rally",
      scope: { domain: "example.com" },
      signIn: "cookies",
      refresh: "never",
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    writeCookies(home, "rally-payments", [
      {
        name: "sid",
        value: secretValue,
        domain: "example.com",
        path: "/",
      },
    ])

    const entityRoot = join(home, "library", "rally-payments", "item", "1")
    const destDir = join(entityRoot, "r1")
    await fakeConnector.pull({
      connection: created.value,
      entityKind: "item",
      entityId: "1",
      entityRoot,
      destDir,
      home,
    })

    const hits = findStringOutsideSecrets(home, secretValue)
    expect(hits).toEqual([])
  })
})

function findStringOutsideSecrets(home: string, needle: string): string[] {
  const secrets = secretsRoot(home)
  const hits: string[] = []
  function walk(dir: string): void {
    if (dir === secrets || dir.startsWith(`${secrets}/`)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.isFile()) continue
      try {
        if (readFileSync(path, "utf8").includes(needle)) hits.push(path)
      } catch {
        // skip unreadable
      }
    }
  }
  walk(home)
  return hits
}
