import {
  createCliTransport,
  type ConnectorTransportHandler,
} from "@workspace/core"
import { createNodeProcessRunner } from "./process-runner.ts"

/** CLI connector transport wired to the Node ProcessRunner (BL-161). */
export function createNodeCliTransport(): ConnectorTransportHandler {
  return createCliTransport(createNodeProcessRunner())
}
