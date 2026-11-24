import {
  connectorCheckMethod,
  connectorGetMethod,
  connectorListMethod,
  connectorRemoveMethod,
  connectorSaveMethod,
  connectorSetCapabilityMethod,
  connectorSignInMethod,
  connectorSignOutMethod,
  type ConnectorSummary,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import type { SecretStore } from "../ports/secret-store.ts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import type { FcpConnection } from "../rpc/initialize.ts"
import type { ChromeBrowserSignIn } from "./browser-sign-in.ts"
import { checkConnector, type ConnectorCheckDeps } from "./check.ts"
import { signInConnector } from "./sign-in.ts"
import { clearConnectorSecrets, signOutConnector } from "./sign-out.ts"
import type { ConnectorService } from "./service.ts"

export type ConnectorBindings = Pick<
  MethodBindings,
  | "connector/list"
  | "connector/get"
  | "connector/save"
  | "connector/remove"
  | "connector/set_capability"
  | "connector/check"
  | "connector/sign_in"
  | "connector/sign_out"
>

type HostPeer = {
  request(method: string, params?: unknown): Promise<unknown>
}

export type ConnectorSignInBindingDeps = {
  secrets: SecretStore
  chromeSignIn?: ChromeBrowserSignIn
  peer?: HostPeer
  connection?: FcpConnection
}

export type CreateConnectorBindingsOptions = {
  check?: Omit<ConnectorCheckDeps, "service">
  signIn?: ConnectorSignInBindingDeps
}

export function createConnectorBindings(
  service: ConnectorService,
  options?: CreateConnectorBindingsOptions
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
      const live = service.getStatus(params.id)
      return {
        connector: record.connector,
        hash: record.hash,
        status: live?.status ?? "off",
        ...(live?.checkedAt !== undefined ? { checkedAt: live.checkedAt } : {}),
        ...(live?.detail !== undefined ? { detail: live.detail } : {}),
      }
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
      const record = service.get(params.id)
      service.remove(params.id)
      const secrets = options?.signIn?.secrets
      if (secrets) clearConnectorSecrets(secrets, params.id)
      const check = options?.check
      if (check && record) {
        check.onStatusChanged?.({
          connectorId: params.id,
          name: record.connector.name,
          status: "off",
          at: new Date(check.clock.now()).toISOString(),
        })
      }
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
    "connector/check": defineBinding(
      connectorCheckMethod,
      async (params, ctx) => {
        const check = options?.check
        if (!check) {
          throw engineError(
            "failed_precondition",
            "Connector check is not configured"
          )
        }
        return checkConnector({ service, ...check }, params.id, ctx.signal)
      }
    ),
    "connector/sign_in": defineBinding(
      connectorSignInMethod,
      async (params, ctx) => {
        const signIn = options?.signIn
        if (!signIn) {
          throw engineError(
            "failed_precondition",
            "Connector sign-in is not configured"
          )
        }
        return signInConnector(
          {
            service,
            secrets: signIn.secrets,
            chromeSignIn: signIn.chromeSignIn,
            peer: signIn.peer,
            connection: signIn.connection,
            check: options?.check,
          },
          params.id,
          ctx.signal
        )
      }
    ),
    "connector/sign_out": defineBinding(connectorSignOutMethod, (params) => {
      const signIn = options?.signIn
      const check = options?.check
      if (!signIn || !check) {
        throw engineError(
          "failed_precondition",
          "Connector sign-out is not configured"
        )
      }
      return signOutConnector(
        {
          service,
          secrets: signIn.secrets,
          bus: check.bus,
          clock: check.clock,
          onStatusChanged: check.onStatusChanged,
        },
        params.id
      )
    }),
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
