import { expect, test } from "@playwright/test"

const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"

test.describe("MCP trust (BL-054)", () => {
  test("settings lists allowed MCP servers and revoke clears them", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000)
    const key = `node stub-mcp-${crypto.randomUUID().slice(0, 8)}.mjs`

    const allow = await request.put(`${API}/api/mcp-trust`, {
      data: { key, grant: "always" },
    })
    expect(allow.ok()).toBeTruthy()

    await page.goto("/settings")
    await expect(page.getByTestId("settings-page")).toBeVisible()
    await expect(page.getByTestId("mcp-trust-list")).toBeVisible()
    await expect(page.getByTestId("mcp-trust-row")).toContainText(key)

    await page.screenshot({
      path: "test-results/mcp-trust-settings.png",
      fullPage: true,
    })

    await page.getByTestId("mcp-trust-revoke").click()
    await expect(page.getByTestId("mcp-trust-empty")).toBeVisible()

    const listed = await request.get(`${API}/api/mcp-trust`)
    expect(listed.ok()).toBeTruthy()
    const body = (await listed.json()) as { servers: unknown[] }
    expect(body.servers).toEqual([])
  })

  test("connection page can always-allow an MCP server", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000)
    const id = `conf-${crypto.randomUUID().slice(0, 8)}`
    const key = `node /tmp/stub-mcp-${id}.mjs`

    const create = await request.post(`${API}/api/connections`, {
      data: {
        id,
        connector: "confluence",
        name: "Confluence stub",
        scope: {
          space: "TEAM",
          page: "42",
          command: key,
        },
        signIn: "mcp",
        refresh: "1h",
        policy: "read-only",
      },
    })
    expect(create.ok()).toBeTruthy()

    await page.goto(`/connections/${id}`)
    await expect(page.getByTestId("connection-page")).toBeVisible()
    await expect(page.getByTestId("connection-mcp-allow")).toBeVisible()
    await expect(page.getByTestId("connection-sign-in-status")).toContainText(
      /mcp_trust_required|allow MCP/i
    )

    await page.getByTestId("connection-mcp-allow").click()
    await expect(page.getByTestId("mcp-trust-dialog")).toBeVisible()
    await page.getByTestId("mcp-trust-always").click()
    await expect(page.getByTestId("connection-mcp-revoke")).toBeVisible({
      timeout: 10_000,
    })

    await page.goto("/settings")
    await expect(page.getByTestId("mcp-trust-list")).toContainText(key)
  })
})
