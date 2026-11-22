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

  it("maps headings and tables to design tokens and shadcn parts", () => {
    const { container } = render(
      <SummaryMarkdown
        text={"# Title\n\n## Part\n\n| a | b |\n|---|---|\n| 1 | 2 |"}
      />
    )
    expect(container.querySelector("h1")?.className).toContain(
      "font-heading text-xl"
    )
    expect(container.querySelector("h2")?.className).toContain(
      "font-heading text-base"
    )
    expect(container.querySelector("[data-slot='table']")).not.toBeNull()
  })
})
