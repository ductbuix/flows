import type { Capability, ConnectorFile } from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import type { SecretStore } from "../ports/secret-store.ts"
import { authHeaders, isApiAuth } from "./api-auth.ts"
import type {
  ConnectorCallResult,
  ConnectorCheckResult,
  ConnectorTransportHandler,
} from "./transport.ts"

export type ApiTransportDeps = {
  secrets: SecretStore
  fetch?: typeof globalThis.fetch
  /** Epoch ms; inject in tests (DES-042). */
  now?: () => number
  /**
   * Fired when an HTTP response is 401 so the host can mark the connector
   * `expired` (BL-162).
   */
  onUnauthorized?: (connector: ConnectorFile, detail: string) => void
}

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])

/**
 * API transport: `how` is the base URL; capability `cmd` is
 * `[method, path]`; auth comes from SecretStore (cookies or Bearer token).
 */
export function createApiTransport(
  deps: ApiTransportDeps
): ConnectorTransportHandler {
  const fetchFn = deps.fetch ?? globalThis.fetch
  const now = deps.now ?? (() => Date.now())

  return {
    kind: "api",
    async call(connector, capability, args, signal) {
      assertApiConnector(connector)
      const { method, path } = resolveCmd(capability, args)
      return request(deps, fetchFn, now, connector, method, path, signal)
    },
    async check(connector, signal): Promise<ConnectorCheckResult> {
      assertApiConnector(connector)
      try {
        const result = await request(
          deps,
          fetchFn,
          now,
          connector,
          "GET",
          "",
          signal
        )
        if (result.exitCode === 0) {
          return {
            ok: true,
            detail: result.stdout.trim() || undefined,
          }
        }
        return {
          ok: false,
          detail: result.stderr.trim() || `HTTP ${result.exitCode}`,
        }
      } catch (err) {
        return {
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
        }
      }
    },
  }
}

async function request(
  deps: ApiTransportDeps,
  fetchFn: typeof globalThis.fetch,
  now: () => number,
  connector: ConnectorFile,
  method: string,
  path: string,
  signal: AbortSignal
): Promise<ConnectorCallResult> {
  const headers = authHeaders(deps.secrets, connector, now())
  if (!headers) {
    throw engineError("failed_precondition", "not signed in")
  }
  const url = joinUrl(connector.how, path)
  const res = await fetchFn(url, { method, headers, signal })
  const body = await res.text()
  if (res.status === 401) {
    const detail = "sign-in expired"
    deps.onUnauthorized?.(connector, detail)
    return { stdout: body, stderr: detail, exitCode: 401 }
  }
  if (res.status >= 200 && res.status < 300) {
    return { stdout: body, stderr: "", exitCode: 0 }
  }
  return {
    stdout: body,
    stderr: `HTTP ${res.status}`,
    exitCode: res.status,
  }
}

function resolveCmd(
  capability: Capability,
  args: readonly string[]
): { method: string; path: string } {
  const cmd = capability.cmd
  if (!cmd || cmd.length === 0) {
    throw engineError(
      "invalid_params",
      `Capability "${capability.name}" has no cmd mapping`
    )
  }
  const method = cmd[0]!.toUpperCase()
  if (!METHODS.has(method)) {
    throw engineError(
      "invalid_params",
      `Capability "${capability.name}" cmd method must be HTTP, got "${cmd[0]}"`
    )
  }
  const basePath = cmd[1] ?? ""
  const path = [basePath, ...args]
    .filter((p) => p.length > 0)
    .join("/")
    .replace(/\/{2,}/g, "/")
  return { method, path }
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, "")
  if (path.length === 0) return b
  if (/^https?:\/\//i.test(path)) return path
  return path.startsWith("/") ? `${b}${path}` : `${b}/${path}`
}

function assertApiConnector(connector: ConnectorFile): void {
  if (connector.transport !== "api") {
    throw engineError(
      "invalid_params",
      `API transport cannot run connector with transport "${connector.transport}"`
    )
  }
  if (!isApiAuth(connector.auth)) {
    throw engineError(
      "invalid_params",
      `API transport cannot run connector with auth "${connector.auth}"`
    )
  }
}
