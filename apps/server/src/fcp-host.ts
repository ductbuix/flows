import { randomUUID } from "node:crypto"
import { pingMethod } from "@workspace/contracts"
import {
  UpdateBus,
  bindEngine,
  createEventBus,
  bindInitialize,
  createFcpConnection,
  createSubscribeBindings,
  defineBinding,
  type MethodBindings,
} from "@workspace/core"
import type { Engine } from "@workspace/engine"
import { RpcPeer, type Transport } from "@workspace/protocol"
import { createCoreRunHost, type CoreRunHost } from "./core-run-host.ts"
import { bindEngineToBus } from "./engine-bus.ts"
import { createConnectorsFcp, type ConnectorsFcp } from "./fcp-connectors.ts"
import { createDocketFcp } from "./fcp-docket.ts"
import { createFileFcp } from "./fcp-files.ts"
import { createInboxFcp } from "./fcp-inbox.ts"
import { createLibraryFcp } from "./fcp-library.ts"
import { createRunCommandBindings } from "./fcp-run-commands.ts"
import { createRunReadBindings } from "./fcp-run-read.ts"
import { createSettingsFcp } from "./fcp-settings.ts"
import { createSkillsFcp } from "./fcp-skills.ts"
import { createWorkflowReadBindings } from "./fcp-workflow-read.ts"
import { createWorkflowWriteBindings } from "./fcp-workflow-write.ts"
import { IdempotencyStore } from "./idempotency.ts"

const engineInfo = { name: "flows", version: "0.0.1" }

export type FcpHost = {
  bus: UpdateBus
  idempotency: IdempotencyStore
  extraBindings: Partial<MethodBindings>
  connectors: ConnectorsFcp
  coreRuns: CoreRunHost
  dispose: () => void
}

/** Shared FCP method stack for the daemon, CLI stdio host, and in-process CLI. */
export function createFcpHost(engine: Engine): FcpHost {
  const bus = new UpdateBus()
  const events = createEventBus()
  const unsubBus = bindEngineToBus(engine, bus, events)
  const docket = createDocketFcp(engine, bus, events)
  const inbox = createInboxFcp(engine, bus)
  const library = createLibraryFcp(engine, bus)
  const skills = createSkillsFcp(engine, bus)
  const settings = createSettingsFcp(engine)
  const connectors = createConnectorsFcp(engine, bus, inbox.inbox)
  const idempotency = new IdempotencyStore()
  const coreRuns = createCoreRunHost(engine)
  return {
    bus,
    idempotency,
    connectors,
    coreRuns,
    extraBindings: {
      ...docket.bindings,
      ...inbox.bindings,
      ...library.bindings,
      ...skills.bindings,
      ...settings,
    },
    dispose() {
      coreRuns.dispose()
      unsubBus()
      docket.dispose()
      inbox.dispose()
      skills.dispose()
    },
  }
}

export type BindFcpTransportOptions = {
  /** When set, advertise blobs.http (daemon ws); omit for stdio/MessagePort. */
  blobsHttp?: string
}

/** Bind one FCP peer on any transport (ws, ndjson, linked). */
export function bindFcpTransport(
  transport: Transport,
  engine: Engine,
  host: FcpHost,
  options: BindFcpTransportOptions = {}
): void {
  const peer = new RpcPeer(transport)
  const connection = createFcpConnection()
  const ac = new AbortController()
  const peerId = randomUUID()
  const { bindings: subBindings, dispose: subDispose } =
    createSubscribeBindings(host.bus, peer, peerId)
  transport.onClose(() => {
    ac.abort()
    subDispose.dispose()
  })

  bindInitialize(peer, connection, {
    engineInfo,
    workspace: { home: engine.home, id: engine.home },
    ...(options.blobsHttp
      ? { engineCapabilities: { blobs: { http: options.blobsHttp } } }
      : {}),
  })
  bindEngine(
    peer,
    {
      ping: defineBinding(pingMethod, () => ({ ok: true as const })),
      ...createWorkflowReadBindings(engine),
      ...createWorkflowWriteBindings({ engine, bus: host.bus }),
      ...subBindings,
      ...createRunReadBindings(engine),
      ...createRunCommandBindings({
        engine,
        idempotency: host.idempotency,
        coreRuns: host.coreRuns,
      }),
      ...createFileFcp(engine, peer, connection),
      ...host.connectors.bindings({ peer, connection }),
      ...host.extraBindings,
    },
    { signal: ac.signal },
    { connection }
  )
}
