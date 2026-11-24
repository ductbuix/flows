import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router"
import { App } from "./App"
import { ThemeProvider } from "@/components/theme-provider"

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 }))
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderApp(path = "/") {
  return render(
    <ThemeProvider defaultTheme="light">
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>
  )
}

async function expectDocketShell() {
  expect(await screen.findByTestId("app-sidebar")).toBeTruthy()
  expect(await screen.findByTestId(/^(fcp-loading|fcp-error)$/)).toBeTruthy()
}

describe("App", () => {
  it("redirects / to /docket and shows the app sidebar", async () => {
    renderApp("/")
    await expectDocketShell()
  })

  it("keeps /mock/docket as a redirect into the app", async () => {
    renderApp("/mock/docket")
    await expectDocketShell()
  })

  it("opens settings as a panel from the sidebar footer", async () => {
    renderApp("/docket")
    expect(await screen.findByTestId("app-sidebar")).toBeTruthy()
    screen.getByTestId("settings-open").click()
    expect(await screen.findByTestId("settings-panel")).toBeTruthy()
    expect(screen.getByTestId("theme-toggle")).toBeTruthy()
  })

  it("redirects /settings away from a settings page", async () => {
    renderApp("/settings")
    await expectDocketShell()
    expect(screen.queryByTestId("settings-page")).toBeNull()
  })

  it("renders the brand index", async () => {
    renderApp("/brand")
    expect(await screen.findByTestId("brand-page")).toBeTruthy()
  })
})
