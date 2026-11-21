import { afterEach, describe, expect, it } from "vitest"
import { fakeConnector } from "./fake.ts"
import {
  clearConnectors,
  getConnector,
  listConnectors,
  registerConnector,
  unregisterConnector,
} from "./registry.ts"

afterEach(() => {
  clearConnectors()
})

describe("connector registry", () => {
  it("registers and lists connectors by id", () => {
    registerConnector(fakeConnector)
    expect(getConnector("fake")).toBe(fakeConnector)
    expect(listConnectors().map((c) => c.id)).toEqual(["fake"])
    expect(fakeConnector.describe().entityKinds).toEqual(["item"])
  })

  it("unregisters a connector", () => {
    registerConnector(fakeConnector)
    unregisterConnector("fake")
    expect(getConnector("fake")).toBeUndefined()
  })
})
