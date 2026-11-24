import {
  createAcpAsks,
  type AcpAsks,
  type AcpInboxAnswerInput,
  type AcpInboxGates,
} from "@workspace/core"
import type { EventLog } from "./event-log.ts"

/**
 * Engine-backed ACP ask gates (BL-192). Thin wrap of core `createAcpAsks`
 * over the EventLog append path.
 */
export function createEngineAcpAsks(log: EventLog): EngineAcpAsks {
  return createAcpAsks({
    append: (event) => {
      log.append(event)
    },
  })
}

export type EngineAcpAsks = AcpAsks

export type { AcpInboxAnswerInput, AcpInboxGates }
