import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { copyPinnedEntity, ensureLibraryGcAutoOff } from "./work-copy.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-work-"))
  homes.push(home)
  return home
}

describe("work copies", () => {
  it("git clone --shared work copy allows commit; library has gc.auto=0", () => {
    const home = tempHome()
    const src = join(home, "repo-src")
    mkdirSync(src, { recursive: true })
    writeFileSync(join(src, "readme.txt"), "hello")
    execFileSync("git", ["-C", src, "init"], { stdio: "ignore" })
    execFileSync("git", ["-C", src, "config", "user.email", "t@example.com"], {
      stdio: "ignore",
    })
    execFileSync("git", ["-C", src, "config", "user.name", "test"], {
      stdio: "ignore",
    })
    execFileSync("git", ["-C", src, "add", "."], { stdio: "ignore" })
    execFileSync("git", ["-C", src, "commit", "-m", "init"], {
      stdio: "ignore",
    })

    const dest = join(home, "work-repo")
    copyPinnedEntity(src, dest)
    ensureLibraryGcAutoOff(src)
    const gc = execFileSync("git", ["-C", src, "config", "gc.auto"], {
      encoding: "utf8",
    }).trim()
    expect(gc).toBe("0")

    writeFileSync(join(dest, "readme.txt"), "hello world")
    execFileSync("git", ["-C", dest, "add", "."], { stdio: "ignore" })
    execFileSync("git", ["-C", dest, "config", "user.email", "t@example.com"], {
      stdio: "ignore",
    })
    execFileSync("git", ["-C", dest, "config", "user.name", "test"], {
      stdio: "ignore",
    })
    execFileSync("git", ["-C", dest, "commit", "-m", "edit"], {
      stdio: "ignore",
    })
    const log = execFileSync("git", ["-C", dest, "log", "--oneline"], {
      encoding: "utf8",
    })
    expect(log).toMatch(/edit/)
  })
})
