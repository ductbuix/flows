import { MessageChannel } from "node:worker_threads"
import { afterEach, describe, expect, it, vi } from "vitest"
import { JSONRPC_VERSION, type JsonRpcMessage } from "./json-rpc.ts"
import { messagePortTransport } from "./message-port-transport.ts"

const ping: JsonRpcMessage = {
  jsonrpc: JSONRPC_VERSION,
  method: "ping",
  id: 1,
}

function waitMessage(
  transport: ReturnType<typeof messagePortTransport>
): Promise<JsonRpcMessage> {
  return new Promise((resolve) => {
    const off = transport.onMessage((msg) => {
      off()
      resolve(msg)
    })
  })
}

function waitClose(
  transport: ReturnType<typeof messagePortTransport>
): Promise<Error | undefined> {
  return new Promise((resolve) => {
    transport.onClose((err) => resolve(err))
  })
}

describe("messagePortTransport", () => {
  const channels: MessageChannel[] = []

  afterEach(() => {
    for (const channel of channels.splice(0)) {
      channel.port1.close()
      channel.port2.close()
    }
  })

  function openPair() {
    const channel = new MessageChannel()
    channels.push(channel)
    return {
      a: messagePortTransport(channel.port1),
      b: messagePortTransport(channel.port2),
      port1: channel.port1,
      port2: channel.port2,
    }
  }

  it("posts plain objects with no JSON string round trip", async () => {
    const { a, b, port1 } = openPair()
    const postSpy = vi.spyOn(port1, "postMessage")
    const received = waitMessage(b)

    a.send(ping)

    await expect(received).resolves.toEqual(ping)
    expect(postSpy).toHaveBeenCalledTimes(1)
    const posted = postSpy.mock.calls[0]?.[0]
    expect(posted).toEqual(ping)
    expect(typeof posted).toBe("object")
    expect(typeof posted).not.toBe("string")

    a.close()
    b.close()
  })

  it("round-trips a message over worker_threads MessageChannel", async () => {
    const { a, b } = openPair()
    const received = waitMessage(b)
    a.send(ping)
    await expect(received).resolves.toEqual(ping)
    a.close()
    b.close()
  })

  it("calls onClose when the local end closes", async () => {
    const { a, b } = openPair()
    const closed = waitClose(a)
    a.close()
    await expect(closed).resolves.toBeUndefined()
    b.close()
  })

  it("calls onClose when the remote end closes", async () => {
    const { a, b } = openPair()
    const closed = waitClose(a)
    b.close()
    await expect(closed).resolves.toBeUndefined()
  })
})
