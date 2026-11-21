import { expect, test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { e2eHome } from "./helpers"

const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"

test.describe("connection cookie sign-in", () => {
  test("shows signed-in status and remove sign-in clears cookies", async ({
    page,
    request,
  }) => {
    const id = "rally-e2e"
    const home = e2eHome()
    const connDir = join(home, "connections", id)
    mkdirSync(connDir, { recursive: true })
    writeFileSync(
      join(connDir, "connection.yaml"),
      [
        "id: rally-e2e",
        "connector: fake",
        "name: Rally E2E",
        "scope:",
        "  domain: example.com",
        "signIn: cookies",
        "refresh: never",
        "policy: read-only",
        "serial: false",
        "",
      ].join("\n")
    )
    const secrets = join(home, "secrets", id)
    mkdirSync(secrets, { recursive: true })
    writeFileSync(
      join(secrets, "cookies.json"),
      `${JSON.stringify([
        {
          name: "sid",
          value: "e2e-session",
          domain: "example.com",
          path: "/",
        },
      ])}\n`
    )

    await page.goto(`/connections/${id}`)
    await expect(page.getByTestId("connection-page")).toBeVisible()
    await expect(page.getByTestId("connection-sign-in-status")).toHaveText(
      "Signed in"
    )
    await expect(page.getByTestId("connection-sign-in-browser")).toBeVisible()
    await expect(page.getByTestId("connection-remove-sign-in")).toBeEnabled()

    await page.getByTestId("connection-remove-sign-in").click()
    await expect(page.getByTestId("connection-sign-in-status")).toHaveText(
      "Signed out"
    )

    const status = await request.get(`${API}/api/connections/${id}/sign-in`)
    expect(status.ok()).toBeTruthy()
    expect(await status.json()).toEqual({ signedIn: false })
  })
})
