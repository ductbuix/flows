import { describe, expect, it } from "vitest"
import { hashUtf8Text } from "./hash.ts"

describe("hashUtf8Text", () => {
  it("hashes empty string", () => {
    expect(hashUtf8Text("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
  })

  it("hashes known utf8 text", () => {
    expect(hashUtf8Text("hello\nworld")).toBe(
      "26c60a61d01db5836ca70fefd44a6a016620413c8ef5f259a6c5612d4f79d3b8"
    )
  })
})
