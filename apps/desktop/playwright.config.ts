import { defineConfig } from "@playwright/test"
import { cpSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(fileURLToPath(import.meta.url))
const fixtureHome = join(root, "fixtures/home")

/** Fresh FLOWAPP_HOME per playwright run so the utility host sees fixture cards. */
export function materializeSmokeHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-desktop-smoke-"))
  cpSync(fixtureHome, home, { recursive: true })
  return home
}

export default defineConfig({
  testDir: "smoke",
  outputDir: "smoke-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
})

export function removeSmokeHome(home: string): void {
  rmSync(home, { recursive: true, force: true })
}
