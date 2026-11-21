import { createServer } from "node:net"
import { afterEach, describe, expect, it } from "vitest"
import {
  DEFAULT_PORT_COUNT,
  PortLeaseManager,
  PORT_RANGE_START,
  portLeaseKey,
  portLeases,
} from "./port-lease.ts"

afterEach(() => {
  portLeases.reset()
})

function holdPort(port: number): Promise<{ close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(port, "127.0.0.1", () => {
      resolve({
        close: () =>
          new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()))
          }),
      })
    })
  })
}

describe("PortLeaseManager", () => {
  it("gives parallel leases disjoint blocks", async () => {
    const mgr = new PortLeaseManager()
    const [a, b] = await Promise.all([mgr.lease("r1:a:1"), mgr.lease("r1:b:1")])
    expect(a.count).toBe(DEFAULT_PORT_COUNT)
    expect(b.count).toBe(DEFAULT_PORT_COUNT)
    expect(a.base).not.toBe(b.base)
    const aEnd = a.base + a.count - 1
    const bEnd = b.base + b.count - 1
    expect(aEnd < b.base || bEnd < a.base).toBe(true)
    mgr.reset()
  })

  it("releases a block so the next lease can reuse it", async () => {
    const mgr = new PortLeaseManager()
    const first = await mgr.lease("r1:a:1")
    mgr.release("r1:a:1")
    expect(mgr.heldBases()).toEqual([])
    const second = await mgr.lease("r1:b:1")
    expect(second.base).toBe(first.base)
    mgr.reset()
  })

  it("skips a base when bind check fails", async () => {
    const held = await holdPort(PORT_RANGE_START)
    try {
      const mgr = new PortLeaseManager()
      const block = await mgr.lease("r1:a:1")
      expect(block.base).toBeGreaterThan(PORT_RANGE_START)
      mgr.reset()
    } finally {
      await held.close()
    }
  })

  it("rehold restores a block after resume without bind", () => {
    const mgr = new PortLeaseManager()
    mgr.rehold("r1:a:1", { base: 23_000, count: 10 })
    expect(mgr.heldBases()).toEqual([23_000])
    mgr.release("r1:a:1")
    expect(mgr.heldBases()).toEqual([])
  })

  it("portLeaseKey is stable", () => {
    expect(portLeaseKey("run", "task", 2)).toBe("run:task:2")
  })
})
