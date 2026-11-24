import { describe, expect, it } from "vitest"
import { refFromLink } from "./ref-from-link"

describe("refFromLink", () => {
  it("maps known hosts and rejects bad URLs", () => {
    expect(refFromLink("https://github.com/acme/app/issues/1")).toEqual({
      system: "github",
      url: "https://github.com/acme/app/issues/1",
      label: "github.com/acme/app/issues/1",
    })
    expect(refFromLink("https://www.rallydev.com/story/US1")).toMatchObject({
      system: "rally",
    })
    expect(refFromLink("not-a-url")).toBeNull()
  })
})
