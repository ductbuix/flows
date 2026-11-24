import { expect, test, type Page } from "@playwright/test"

// Layout check (DES-030): every root shell route, light and dark, 1440x900.
test.use({ viewport: { width: 1440, height: 900 } })

const CONTENT = '[class~="@container/main"]'
const DENSE =
  "[data-slot=table-cell],[data-slot=table-head],[data-slot=item-actions]," +
  "[data-slot=input-group],[data-slot=sidebar],[data-sidebar],[data-slot=code-block]," +
  "[data-testid=graph-canvas],[data-testid=canvas],[data-slot=prompt-input],[role=dialog]"

type Route = {
  name: string
  path: string
  ready: string
  /** Content that varies with other specs: masked / clipped in baselines. */
  dynamic?: boolean
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
  { name: "docket", path: "/docket", ready: "docket-page", dynamic: true },
  { name: "inbox", path: "/inbox", ready: "mock-inbox-page", dynamic: true },
  {
    name: "workflows",
    path: "/workflows",
    ready: "workflows-new-open",
    dynamic: true,
  },
  {
    name: "workflow-editor",
    path: "/workflows/diamond",
    ready: "workflow-editor-yaml",
    dynamic: true,
  },
  { name: "runs", path: "/runs", ready: "runs-start-open", dynamic: true },
  {
    name: "connectors",
    path: "/connectors",
    ready: "connector-add-open",
    dynamic: true,
  },
  {
    name: "library",
    path: "/library",
    ready: "library-search",
    dynamic: true,
  },
  {
    name: "skills",
    path: "/skills",
    ready: "skills-installed",
    dynamic: true,
  },
  { name: "files", path: "/files", ready: "files-tree", dynamic: true },
]

test.describe("layout check (BL-061 / BL-185)", () => {
  for (const theme of themes) {
    for (const route of routes) {
      test(`${route.name} (${theme})`, async ({ page }) => {
        await setTheme(page, theme)
        await page.goto(route.path)
        await expect(page.getByTestId(route.ready).first()).toBeVisible({
          timeout: 30_000,
        })
        await expect(page.locator("html")).toHaveClass(new RegExp(theme))
        await expectLayout(page, route)

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
            height: route.dynamic ? 160 : 852,
          },
        })
      })
    }
  }
})
