import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AttemptKindBadge } from "./AttemptKindBadge"

afterEach(cleanup)

describe("AttemptKindBadge", () => {
  it("shows Retry n/max text", () => {
    render(
      <AttemptKindBadge
        attempt={2}
        kind={{
          kind: "retry",
          label: "Retry 2/3",
          ariaLabel: "Retry 2 of 3 after exit code 1",
          n: 2,
          max: 3,
        }}
      />
    )
    expect(screen.getByTestId("attempt-kind-2").textContent).toContain(
      "Retry 2/3"
    )
  })
})
