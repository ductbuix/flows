import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { LibraryUsageAlert } from "./LibraryUsageAlert"

afterEach(cleanup)

describe("LibraryUsageAlert", () => {
  it("hides below 80 percent", () => {
    const { container } = render(
      <LibraryUsageAlert usage={{ usedBytes: 79, maxBytes: 100 }} />
    )
    expect(container.textContent).toBe("")
    expect(screen.queryByTestId("library-size-warning")).toBeNull()
  })

  it("shows at 80 percent", () => {
    render(<LibraryUsageAlert usage={{ usedBytes: 80, maxBytes: 100 }} />)
    expect(screen.getByTestId("library-size-warning").textContent).toContain(
      "Library nearly full"
    )
  })
})
