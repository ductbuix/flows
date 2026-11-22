import { expect, test, type Page } from "@playwright/test"
import { startRun } from "./helpers"

// Layout check (DES-030): every route, light and dark, 1440x900.
test.use({ viewport: { width: 1440, height: 900 } })

const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"
const CONTENT = '[class~="@container/main"]'
const DENSE =
  "[data-slot=table-cell],[data-slot=table-head],[data-slot=item-actions]," +
  "[data-slot=input-group],[data-slot=sidebar],[data-sidebar],[data-slot=code-block]," +
  "[data-testid=graph-canvas],[data-slot=prompt-input],[role=dialog]"

type Route = {
  name: string
  path: () => string
  ready: string
  /** Content that varies with other specs (runs, items): masked in baselines. */
  dynamic?: boolean
  /** Table rows still wrap; remove when the named backlog item lands. */
  rowsPending?: string
}

const themes = ["light", "dark"] as const

async function setTheme(page: Page, theme: (typeof themes)[number]) {
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
}

async function expectLayout(page: Page, route: Route) {
  const header = page.locator("header").first()
  expect((await header.boundingBox())?.height).toBe(48)

  const h1 = page.locator("h1")
  await expect(h1).toHaveCount(1)
  const box = await h1.boundingBox()
  expect(Math.round(box?.x ?? 0)).toBe(280)
  expect(await h1.evaluate((el) => getComputedStyle(el).fontSize)).toBe("20px")

  const content = page.locator(CONTENT).first()
  expect(
    await content.evaluate((el) => getComputedStyle(el).paddingTop)
  ).toBe("24px")

  const edges = await content.evaluate((el) =>
    [...el.children]
      .filter((child) => !child.hasAttribute("data-bleed"))
      .map((child) => ({
        id: child.getAttribute("data-testid") ?? child.tagName,
        x: Math.round(child.getBoundingClientRect().x),
      }))
  )
  for (const e of edges) expect(e.x, `${route.name} ${e.id}`).toBe(280)

  const controls = await page.evaluate((dense) => {
    const out: { slot: string; h: number }[] = []
    for (const el of document.querySelectorAll(
      "[data-slot=button],[data-slot=input],[data-slot=select-trigger]"
    )) {
      // Link-variant buttons are inline text, not controls.
      if (el.closest(dense) || el.classList.contains("underline-offset-4")) continue
      const r = el.getBoundingClientRect()
      if (r.height === 0) continue
      out.push({
        slot: `${el.getAttribute("data-slot")}:${el.getAttribute("data-testid") ?? el.textContent?.trim().slice(0, 20)}`,
        h: Math.round(r.height),
      })
    }
    return out
  }, DENSE)
  for (const c of controls) expect(c.h, `${route.name} ${c.slot}`).toBe(32)

  const rows = await page.evaluate(() => {
    const body = [...document.querySelectorAll("tbody [data-slot=table-row]")]
    const head = [...document.querySelectorAll("thead [data-slot=table-row]")]
    const h = (els: Element[]) =>
      els.map((e) => Math.round(e.getBoundingClientRect().height))
    return { body: h(body), head: h(head) }
  })
  if (route.rowsPending) return
  for (const h of rows.body) expect(h, `${route.name} body row`).toBe(37)
  for (const h of rows.head) expect(h, `${route.name} header row`).toBe(41)
}

test.describe("layout check (BL-061)", () => {
  let workItemId = ""
  let runId = ""
  let connectionId = ""

  test.beforeAll(async ({ request }) => {
    runId = await startRun(request, "diamond")
    const created = await request.post(`${API}/api/workitems`, {
      data: { title: "Layout check", workflowId: "diamond" },
    })
    expect(created.ok()).toBeTruthy()
    workItemId = ((await created.json()) as { item: { id: string } }).item.id
    connectionId = `layout-${crypto.randomUUID().slice(0, 8)}`
    const conn = await request.post(`${API}/api/connections`, {
      data: {
        id: connectionId,
        connector: "fake",
        name: "Layout fake",
        signIn: "cli",
        refresh: "never",
      },
    })
    expect(conn.ok(), await conn.text()).toBeTruthy()
  })

  const routes: Route[] = [
    { name: "home", path: () => "/", ready: "home-page", dynamic: true },
    {
      name: "work-items",
      path: () => "/work-items",
      ready: "work-items-page",
      dynamic: true,
    },
    {
      name: "work-item",
      path: () => `/work-items/${workItemId}`,
      ready: "work-item-page",
      dynamic: true,
    },
    {
      name: "connections",
      path: () => "/connections",
      ready: "connections-page",
      dynamic: true,
      rowsPending: "BL-071",
    },
    {
      name: "connection",
      path: () => `/connections/${connectionId}`,
      ready: "connection-page",
      dynamic: true,
    },
    {
      name: "workflows",
      path: () => "/workflows",
      ready: "workflows-table",
      dynamic: true,
    },
    {
      name: "workflow-overview",
      path: () => "/workflows/diamond",
      ready: "workflow-overview",
      dynamic: true,
    },
    {
      name: "workflow-editor",
      path: () => "/workflows/diamond?tab=editor",
      ready: "graph-canvas",
      dynamic: true,
    },
    {
      name: "workflow-runs",
      path: () => "/workflows/diamond?tab=runs",
      ready: "run-list",
      dynamic: true,
      rowsPending: "BL-070",
    },
    { name: "runs", path: () => "/runs", ready: "runs-table", dynamic: true },
    {
      name: "run",
      path: () => `/runs/${runId}`,
      ready: "run-status",
      dynamic: true,
    },
    { name: "settings", path: () => "/settings", ready: "settings-page" },
  ]

  for (const theme of themes) {
    for (const route of routes) {
      test(`${route.name} (${theme})`, async ({ page }) => {
        await setTheme(page, theme)
        await page.goto(route.path())
        await expect(page.getByTestId(route.ready).first()).toBeVisible({
          timeout: 30_000,
        })
        await expect(page.locator("html")).toHaveClass(new RegExp(theme))
        await expectLayout(page, route)

        // Lists depend on what other specs created, so dynamic routes
        // compare only the title block; the rest is covered by the checks.
        const mask = [
          page.locator("time"),
          page.getByTestId("id-text"),
          page.getByTestId("run-took"),
        ]
        await expect(page).toHaveScreenshot(`${route.name}-${theme}.png`, {
          maxDiffPixelRatio: 0.01,
          mask,
          clip: { x: 256, y: 48, width: 1184, height: route.dynamic ? 160 : 852 },
        })
      })
    }
  }
})
