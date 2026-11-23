import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { hashUtf8Text } from "@workspace/core/kernel/hash"

describe("hashUtf8Text vs node:crypto", () => {
  it("matches sha256 for sample strings", () => {
    for (const text of ["", "hello\nworld", "yaml: true\n"]) {
      const expected = createHash("sha256").update(text, "utf8").digest("hex")
      expect(hashUtf8Text(text)).toBe(expected)
    }
  })
})
