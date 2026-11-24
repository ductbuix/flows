import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"

/** Launch spec for one stdio MCP server (gateway or probe). */
export type McpLaunchSpec = {
  command: string
  args?: readonly string[]
  env?: Readonly<Record<string, string>>
}

/** Key written into `.cursor/mcp.json` (gateway only). */
export const FLOWS_MCP_KEY = "flows"

const MCP_JSON = ".cursor/mcp.json"

/** Per-workDir restore data so cleanup does not delete user files. */
const mcpPlacements = new Map<
  string,
  { path: string; previous: string | null }
>()

/**
 * Write `<workDir>/.cursor/mcp.json` with only the Flows gateway entry
 * (BL-167). Remembers prior content for {@link cleanupPlacedMcp}.
 */
export async function placeMcp(
  servers: readonly McpLaunchSpec[],
  workDir: string
): Promise<void> {
  const launch = servers[0]
  if (!launch) return

  const path = join(workDir, MCP_JSON)
  let previous: string | null
  try {
    previous = await readFile(path, "utf8")
  } catch {
    previous = null
  }

  const body = {
    mcpServers: {
      [FLOWS_MCP_KEY]: {
        command: launch.command,
        args: [...(launch.args ?? [])],
        ...(launch.env && Object.keys(launch.env).length > 0
          ? { env: { ...launch.env } }
          : {}),
      },
    },
  }

  await mkdir(join(workDir, ".cursor"), { recursive: true })
  await writeFile(path, `${JSON.stringify(body, null, 2)}\n`, "utf8")
  mcpPlacements.set(workDir, { path, previous })
}

/** Restore or remove mcp.json placed by {@link placeMcp}. */
export async function cleanupPlacedMcp(workDir: string): Promise<void> {
  const placed = mcpPlacements.get(workDir)
  if (!placed) return
  mcpPlacements.delete(workDir)
  if (placed.previous === null) {
    try {
      await unlink(placed.path)
    } catch {
      /* already gone */
    }
    return
  }
  await writeFile(placed.path, placed.previous, "utf8")
}

/**
 * ACP `session/new` mcpServers entries. Cursor requires `env` as
 * `{name,value}[]` (BL-167 probe).
 */
export function toAcpMcpServers(
  servers: readonly McpLaunchSpec[]
): readonly Record<string, unknown>[] {
  return servers.map((s, i) => ({
    name: i === 0 ? FLOWS_MCP_KEY : `mcp-${i}`,
    type: "stdio",
    command: s.command,
    args: [...(s.args ?? [])],
    env: Object.entries(s.env ?? {}).map(([name, value]) => ({
      name,
      value,
    })),
  }))
}

/** Narrow unknown SessionSpec.mcpServers to launch specs. */
export function asMcpLaunchSpecs(
  servers: readonly unknown[] | undefined
): McpLaunchSpec[] {
  if (!servers?.length) return []
  const out: McpLaunchSpec[] = []
  for (const raw of servers) {
    if (!raw || typeof raw !== "object") continue
    const o = raw as Record<string, unknown>
    if (typeof o.command !== "string" || !o.command) continue
    const args = Array.isArray(o.args)
      ? o.args.filter((a): a is string => typeof a === "string")
      : undefined
    let env: Record<string, string> | undefined
    if (o.env && typeof o.env === "object" && !Array.isArray(o.env)) {
      env = {}
      for (const [k, v] of Object.entries(o.env as Record<string, unknown>)) {
        if (typeof v === "string") env[k] = v
      }
    } else if (Array.isArray(o.env)) {
      env = {}
      for (const row of o.env) {
        if (
          row &&
          typeof row === "object" &&
          typeof (row as { name?: unknown }).name === "string" &&
          typeof (row as { value?: unknown }).value === "string"
        ) {
          env[(row as { name: string }).name] = (row as { value: string }).value
        }
      }
    }
    out.push({ command: o.command, args, env })
  }
  return out
}
