import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { SummaryMarkdown } from "./SummaryMarkdown"

afterEach(cleanup)

describe("SummaryMarkdown", () => {
  it("does not render raw script tags from markdown", () => {
    const { container } = render(
      <SummaryMarkdown text={'<script>alert("x")</script>\n\nHello'} />
    )
    expect(container.querySelector("script")).toBeNull()
    expect(container.textContent).toContain("Hello")
  })

  it("does not link javascript: URLs", () => {
    const { container } = render(
      <SummaryMarkdown text={"[click me](javascript:alert(1))"} />
    )
    const link = container.querySelector("a[href^='javascript:']")
    expect(link).toBeNull()
  })
})
