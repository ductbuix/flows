import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import {
  mcpTrustValueSchema,
  type McpTrustEntry,
  type McpTrustValue,
} from "@workspace/contracts"
import type { McpTrustPort } from "@workspace/core"

/** Session-only grants (trust once); cleared when the process exits. */
const onceGrants = new Set<string>()

export function normalizeMcpServerKey(key: string): string {
  return key.trim()
}

function mcpTrustPath(home: string): string {
  return join(home, "mcp-trust.json")
}

function readMcpTrustValue(home: string): McpTrustValue {
  const path = mcpTrustPath(home)
  if (!existsSync(path)) return { servers: [] }
  try {
    return mcpTrustValueSchema.parse(JSON.parse(readFileSync(path, "utf8")))
  } catch {
    return { servers: [] }
  }
}

function writeMcpTrustValue(home: string, value: McpTrustValue): void {
  mkdirSync(home, { recursive: true })
  const path = mcpTrustPath(home)
  if (value.servers.length === 0) {
    writeFileSync(path, JSON.stringify({ servers: [] }, null, 2))
    return
  }
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2))
  renameSync(tmp, path)
}

export function listAllowedMcpServers(home: string): McpTrustEntry[] {
  return readMcpTrustValue(home)
    .servers.slice()
    .sort((a, b) => a.key.localeCompare(b.key))
}

export function allowMcpServerOnce(key: string): void {
  const normalized = normalizeMcpServerKey(key)
  if (normalized) onceGrants.add(normalized)
}

export function allowMcpServerAlways(home: string, key: string): void {
  const normalized = normalizeMcpServerKey(key)
  if (!normalized) return
  onceGrants.delete(normalized)
  const current = readMcpTrustValue(home)
  const trustedAt = new Date().toISOString()
  const servers = current.servers.filter((s) => s.key !== normalized)
  servers.push({ key: normalized, trustedAt })
  writeMcpTrustValue(home, { servers })
}

export function revokeMcpServer(home: string, key: string): void {
  const normalized = normalizeMcpServerKey(key)
  onceGrants.delete(normalized)
  const current = readMcpTrustValue(home)
  writeMcpTrustValue(home, {
    servers: current.servers.filter((s) => s.key !== normalized),
  })
}

/** Clear session once-grants (tests). */
export function clearMcpOnceGrants(): void {
  onceGrants.clear()
}

/** File-backed MCP allow list under FLOWAPP_HOME (BL-210; BL-214 retires engine copy). */
export function createNodeMcpTrustPort(home: string): McpTrustPort {
  return {
    listServers: () => listAllowedMcpServers(home),
    setGrant(key, grant) {
      if (grant === "always") allowMcpServerAlways(home, key)
      else if (grant === "once") allowMcpServerOnce(key)
      else revokeMcpServer(home, key)
      return listAllowedMcpServers(home)
    },
  }
}
