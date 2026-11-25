import { describe, expect, it } from "vitest"
import { isAllowedNavigation } from "./window-guards.ts"

const app = "file:///app/web/dist/index.html"

describe("isAllowedNavigation", () => {
  it("allows hash routing inside the bundle", () => {
    expect(isAllowedNavigation(`${app}#/inbox`, app)).toBe(true)
  })
  it("blocks other files and remote origins", () => {
    expect(isAllowedNavigation("file:///etc/passwd", app)).toBe(false)
    expect(isAllowedNavigation("https://evil.example/", app)).toBe(false)
    expect(isAllowedNavigation("not a url", app)).toBe(false)
  })
  it("allows only the dev origin when given", () => {
    expect(isAllowedNavigation("http://127.0.0.1:5173/x", app)).toBe(false)
    expect(
      isAllowedNavigation(
        "http://127.0.0.1:5173/x",
        app,
        "http://127.0.0.1:5173"
      )
    ).toBe(true)
  })
})
