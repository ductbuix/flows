import { expect, test } from "@playwright/test"

const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"

test.describe("rally work item source (BL-055)", () => {
  test("connectors list rally; work item from story shows outline Badge", async ({
    page,
    request,
  }) => {
    const connectors = await request.get(`${API}/api/connectors`)
    expect(connectors.ok()).toBeTruthy()
    const body = (await connectors.json()) as {
      connectors: Array<{
        id: string
        entityKinds: string[]
        signInMethods: string[]
      }>
    }
    const rally = body.connectors.find((c) => c.id === "rally")
    expect(rally).toBeTruthy()
    expect(rally?.entityKinds).toEqual(["story", "defect"])
    expect(rally?.signInMethods).toEqual(["cookies"])

    const connId = `rally-e2e-${crypto.randomUUID().slice(0, 8)}`
    const createConn = await request.post(`${API}/api/connections`, {
      data: {
        id: connId,
        connector: "rally",
        name: "Rally E2E",
        scope: {
          workspace: "ws",
          project: "proj",
          url: "https://rally1.rallydev.com",
        },
        signIn: "cookies",
        refresh: "never",
        policy: "read-only",
      },
    })
    expect(createConn.ok()).toBeTruthy()

    const title = `Rally story ${crypto.randomUUID().slice(0, 8)}`
    const createWi = await request.post(`${API}/api/workitems`, {
      data: {
        title,
        source: {
          kind: "rally",
          connection: connId,
          entityKind: "story",
          entityId: "US42",
        },
      },
    })
    expect(createWi.status()).toBe(201)
    const detail = (await createWi.json()) as { item: { id: string } }

    await page.goto(`/work-items/${detail.item.id}`)
    await expect(page.getByTestId("work-item-page")).toBeVisible()
    const source = page.getByTestId("work-item-source")
    await expect(source).toHaveText("Rally US42")
    await expect(source).toHaveClass(/border-border/)

    await page.goto("/work-items")
    await expect(page.getByText(title)).toBeVisible()
    await expect(
      page.getByTestId(`work-items-source-${detail.item.id}`)
    ).toHaveText("Rally US42")
  })
})
