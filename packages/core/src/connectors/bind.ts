import {
  connectorGetMethod,
  connectorListMethod,
  connectorRemoveMethod,
  connectorSaveMethod,
  connectorSetCapabilityMethod,
  type ConnectorSummary,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import type { ConnectorService } from "./service.ts"

export type ConnectorBindings = Pick<
  MethodBindings,
  | "connector/list"
  | "connector/get"
  | "connector/save"
  | "connector/remove"
  | "connector/set_capability"
>

export function createConnectorBindings(
  service: ConnectorService
): ConnectorBindings {
  return {
    "connector/list": defineBinding(connectorListMethod, (params) => {
      const all = service.list()
      return pageSummaries(all, params.cursor, params.limit)
    }),
    "connector/get": defineBinding(connectorGetMethod, (params) => {
      const record = service.get(params.id)
      if (!record) {
        throw engineError("not_found", `Connector not found: ${params.id}`)
      }
      return { connector: record.connector, hash: record.hash }
    }),
    "connector/save": defineBinding(connectorSaveMethod, (params) => {
      const result = service.save(params.connector, params.baseHash)
      if ("conflict" in result) {
        throw engineError("conflict", "Stale baseHash", {
          current: {
            connector: result.conflict.connector,
            hash: result.conflict.hash,
          },
        })
      }
      return { hash: result.hash }
    }),
    "connector/remove": defineBinding(connectorRemoveMethod, (params) => {
      service.remove(params.id)
      return {}
    }),
    "connector/set_capability": defineBinding(
      connectorSetCapabilityMethod,
      (params) => {
        const result = service.setCapability(
          params.id,
          params.name,
          params.allowed,
          params.baseHash
        )
        if ("conflict" in result) {
          throw engineError("conflict", "Stale baseHash", {
            current: {
              connector: result.conflict.connector,
              hash: result.conflict.hash,
            },
          })
        }
        return { hash: result.hash }
      }
    ),
  }
}

function pageSummaries(
  items: ConnectorSummary[],
  cursor: string | undefined,
  limit: number | undefined
): { items: ConnectorSummary[]; next?: string } {
  let start = 0
  if (cursor !== undefined) {
    const idx = items.findIndex((c) => c.id === cursor)
    start = idx === -1 ? items.length : idx + 1
  }
  const size = limit ?? items.length
  const page = items.slice(start, start + size)
  const last = page[page.length - 1]
  const more = start + page.length < items.length
  return {
    items: page,
    ...(more && last ? { next: last.id } : {}),
  }
}
