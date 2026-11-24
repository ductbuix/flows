import type { ConnectorFile } from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import type { SecretStore } from "../ports/secret-store.ts"
import type { FcpConnection } from "../rpc/initialize.ts"
import { cookiesSecretKey } from "./api-auth.ts"
import {
  performBrowserSignIn,
  type BrowserSignInOutcome,
  type ChromeBrowserSignIn,
} from "./browser-sign-in.ts"
import type { ConnectorService } from "./service.ts"
import { checkConnector, type ConnectorCheckDeps } from "./check.ts"

type HostPeer = {
  request(method: string, params?: unknown): Promise<unknown>
}

export type ConnectorSignInDeps = {
  service: ConnectorService
  secrets: SecretStore
  chromeSignIn?: ChromeBrowserSignIn
  peer?: HostPeer
  connection?: FcpConnection
  /** When set, run check after cookies are saved. */
  check?: Omit<ConnectorCheckDeps, "service">
}

export type ConnectorSignInResult = { signedIn: true } | { cancelled: true }

/** Hostname + start URL for cookie auth connectors. */
export function connectorSignInTarget(connector: ConnectorFile): {
  url: string
  cookieDomains: string[]
} {
  let url: URL
  try {
    url = new URL(connector.how)
  } catch {
    throw engineError(
      "invalid_params",
      `Connector how is not a URL: ${connector.how}`
    )
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw engineError(
      "invalid_params",
      `Connector how must be http(s) for cookie sign-in`
    )
  }
  return { url: url.toString(), cookieDomains: [url.hostname] }
}

function saveCookies(
  secrets: SecretStore,
  connectorId: string,
  outcome: Extract<BrowserSignInOutcome, { cookies: unknown }>
): void {
  secrets.set(cookiesSecretKey(connectorId), JSON.stringify(outcome.cookies))
}

/**
 * Cookie browser sign-in for `connector/sign_in` (DES-040 / BL-190).
 * Host window when capable; otherwise Chrome.
 */
export async function signInConnector(
  deps: ConnectorSignInDeps,
  id: string,
  signal: AbortSignal
): Promise<ConnectorSignInResult> {
  const record = deps.service.get(id)
  if (!record) {
    throw engineError("not_found", `Connector not found: ${id}`)
  }
  if (record.connector.auth !== "cookies") {
    throw engineError(
      "invalid_params",
      `Connector auth is ${record.connector.auth}, not cookies`
    )
  }

  const target = connectorSignInTarget(record.connector)
  const outcome = await performBrowserSignIn(
    {
      peer: deps.peer,
      connection: deps.connection,
      chromeSignIn: deps.chromeSignIn,
    },
    {
      connectorId: id,
      url: target.url,
      cookieDomains: target.cookieDomains,
    },
    signal
  )

  if ("cancelled" in outcome) {
    return { cancelled: true }
  }

  saveCookies(deps.secrets, id, outcome)

  if (deps.check) {
    await checkConnector({ service: deps.service, ...deps.check }, id, signal)
  }

  return { signedIn: true }
}
