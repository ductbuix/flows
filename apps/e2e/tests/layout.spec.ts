import { expect, test, type Page } from "@playwright/test"

// Layout check (DES-030 / BL-216): mock screens, light and dark, 1440x900.
test.use({ viewport: { width: 1440, height: 900 } })

const CONTENT = '[class~="@container/main"]'
const DENSE =
  "[data-slot=table-cell],[data-slot=table-head],[data-slot=item-actions]," +
  "[data-slot=input-group],[data-slot=sidebar],[data-sidebar],[data-slot=code-block]," +
  "[data-testid=graph-canvas],[data-testid=canvas],[data-slot=prompt-input],[role=dialog]," +
  // Canvas nodes scale with zoom, so their controls never measure 32px.
  ".react-flow__node"

type Route = {
  name: string
  path: string
  ready: string
  /** Open sheet/panel chrome before metrics + screenshot. */
  prepare?: (page: Page) => Promise<void>
  /** Content that varies with other specs: masked / clipped in baselines. */
  dynamic?: boolean
  /** Override dynamic clip height (default 160). Keep above the variable list. */
  clipHeight?: number
}

const themes = ["light", "dark"] as const

async function setTheme(page: Page, theme: (typeof themes)[number]) {
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
}

async function expectLayout(page: Page, route: Route) {
  const header = page.locator("header").first()
  expect((await header.boundingBox())?.height).toBe(48)

  const h1 = page.locator("h1").first()
  await expect(h1).toBeVisible()
  await expect
    .poll(async () => Math.round((await h1.boundingBox())?.x ?? 0))
    .toBe(280)
  expect(await h1.evaluate((el) => getComputedStyle(el).fontSize)).toBe("20px")

  const content = page.locator(CONTENT).first()
  expect(await content.evaluate((el) => getComputedStyle(el).paddingTop)).toBe(
    "24px"
  )

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
      if (el.closest(dense) || el.classList.contains("underline-offset-4"))
        continue
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
}

const routes: Route[] = [
  {
    name: "docket",
    path: "/docket",
    ready: "docket-page",
    dynamic: true,
    clipHeight: 220,
    prepare: async (page) => {
      await page.getByTestId("docket-card-fix-login").click()
      await expect(page.getByTestId("docket-panel")).toBeVisible()
    },
  },
  { name: "inbox", path: "/inbox", ready: "inbox-page", dynamic: true },
  {
    name: "workflows",
    path: "/workflows",
    ready: "workflows-new-open",
    dynamic: true,
  },
  {
    name: "workflow-editor",
    path: "/workflows/diamond",
    ready: "workflow-editor-tab-canvas",
    dynamic: true,
    clipHeight: 220,
    prepare: async (page) => {
      await expect(page.getByTestId("workflow-canvas")).toBeVisible()
      await page.getByTestId("workflow-canvas-fit").click()
    },
  },
  {
    name: "connectors",
    path: "/connectors",
    ready: "connector-add-open",
    dynamic: true,
    clipHeight: 220,
    prepare: async (page) => {
      await page.getByTestId("connector-row-github-cli").click()
      await expect(page.getByTestId("connector-sheet")).toBeVisible()
    },
  },
  {
    name: "library",
    path: "/library",
    ready: "library-search",
    dynamic: true,
    clipHeight: 220,
    prepare: async (page) => {
      // Name cell only — tag badges in the row steal the click and filter.
      await page
        .getByTestId("library-row-github-acme-demo")
        .locator(".font-medium")
        .first()
        .click()
      await expect(page.getByTestId("library-sheet")).toBeVisible()
    },
  },
  {
    name: "skills",
    path: "/skills",
    ready: "skills-installed",
    dynamic: true,
    clipHeight: 220,
    prepare: async (page) => {
      await page.getByTestId("skills-tab-available").click()
      await expect(page.getByTestId("skills-tab-available")).toHaveAttribute(
        "aria-selected",
        "true"
      )
      await page.getByTestId("skills-tab-installed").click()
    },
  },
  { name: "files", path: "/files", ready: "files-tree", dynamic: true },
  {
    name: "settings",
    path: "/docket",
    ready: "settings-panel",
    dynamic: true,
    clipHeight: 280,
    prepare: async (page) => {
      await expect(page.getByTestId("docket-page")).toBeVisible()
      await page.getByTestId("settings-open").click()
      await expect(page.getByTestId("settings-panel")).toBeVisible()
    },
  },
]

test.describe("layout check (BL-061 / BL-216)", () => {
  for (const theme of themes) {
    for (const route of routes) {
      test(`${route.name} (${theme})`, async ({ page }) => {
        await setTheme(page, theme)
        await page.goto(route.path)
        if (route.prepare) await route.prepare(page)
        await expect(page.getByTestId(route.ready).first()).toBeVisible({
          timeout: 30_000,
        })
        await expect(page.locator("html")).toHaveClass(new RegExp(theme))
        // Settings is a side panel over docket; skip main-column edge rules.
        if (route.name !== "settings") await expectLayout(page, route)

        const mask = [
          page.locator("time"),
          page.getByTestId("id-text"),
          page.getByTestId("run-took"),
        ]
        await expect(page).toHaveScreenshot(`${route.name}-${theme}.png`, {
          maxDiffPixelRatio: 0.01,
          mask,
          clip: {
            x: 256,
            y: 48,
            width: 1184,
            height: route.dynamic ? (route.clipHeight ?? 160) : 852,
          },
        })
      })
    }
  }
})
