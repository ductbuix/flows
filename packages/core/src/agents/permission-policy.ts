/**
 * Permission policy chain (DES-041). First rule that decides wins.
 * Pure: no I/O; remembered answers are passed in from settings.
 */

export type PermissionOutcome = "allow_once" | "allow_always" | "reject" | "ask"

export type PermissionRule =
  "path" | "connector" | "allowlist" | "remembered" | "ask"

export type PermissionDecision = {
  readonly outcome: PermissionOutcome
  readonly rule: PermissionRule
}

export type PermissionRequest = {
  /** Tool id (ACP tool, gateway tool name, or fs method). */
  readonly tool: string
  /** Optional ACP tool kind; allowlist matches tool or kind. */
  readonly toolKind?: string
  /** When set, this is a write and path policy applies. */
  readonly writePath?: string
  /**
   * When true, the request needs connector write capability.
   * When false or omitted, the connector rule does not decide.
   */
  readonly connectorWrite?: boolean
}

export type PermissionContext = {
  /** Absolute roots a write may target (step work dir, card assets). */
  readonly allowedRoots: readonly string[]
  /** Mockup default is false: write capability off → reject. */
  readonly connectorWriteEnabled: boolean
  /** Tools or kinds listed on the node. */
  readonly nodeAllowlist: readonly string[]
  /** Tools previously answered allow_always for this workflow. */
  readonly rememberedAllowAlways: readonly string[]
}

const ALLOW_ALWAYS_KEY_PREFIX = "permission_allow_always:"

/** Settings key for one workflow's remembered allow_always tools. */
export function allowAlwaysSettingsKey(workflowId: string): string {
  return `${ALLOW_ALWAYS_KEY_PREFIX}${workflowId}`
}

/** Parse a settings value into tool ids; tolerant of bad or missing data. */
export function parseAllowAlwaysTools(
  raw: string | null | undefined
): string[] {
  if (raw == null || raw === "") return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((t): t is string => typeof t === "string" && t !== "")
  } catch {
    return []
  }
}

export function serializeAllowAlwaysTools(tools: readonly string[]): string {
  return JSON.stringify([...new Set(tools)].sort())
}

/** Add a tool to the remembered set (immutable). */
export function withAllowAlwaysTool(
  tools: readonly string[],
  tool: string
): string[] {
  if (tools.includes(tool)) return [...tools]
  return [...tools, tool].sort()
}

/** Normalize separators and resolve `.` / `..` (string-only; no real FS). */
export function normalizePermissionPath(path: string): string {
  const raw = path.replace(/\\/g, "/")
  const absolute = raw.startsWith("/")
  const out: string[] = []
  for (const part of raw.split("/")) {
    if (part === "" || part === ".") continue
    if (part === "..") {
      out.pop()
      continue
    }
    out.push(part)
  }
  const joined = out.join("/")
  if (absolute) return `/${joined}`
  return joined
}

function isUnderRoot(path: string, root: string): boolean {
  const p = normalizePermissionPath(path)
  const r = normalizePermissionPath(root)
  if (r === "" || r === "/") return false
  return p === r || p.startsWith(`${r}/`)
}

function pathAllowsWrite(writePath: string, roots: readonly string[]): boolean {
  return roots.some((root) => isUnderRoot(writePath, root))
}

function allowlistHit(
  request: PermissionRequest,
  allowlist: readonly string[]
): boolean {
  if (allowlist.includes(request.tool)) return true
  return request.toolKind !== undefined && allowlist.includes(request.toolKind)
}

/**
 * Ordered rules: path → connector → allowlist → remembered → ask.
 * Returns the outcome and which rule decided.
 */
export function decidePermission(
  request: PermissionRequest,
  context: PermissionContext
): PermissionDecision {
  if (
    request.writePath !== undefined &&
    !pathAllowsWrite(request.writePath, context.allowedRoots)
  ) {
    return { outcome: "reject", rule: "path" }
  }

  if (request.connectorWrite === true && !context.connectorWriteEnabled) {
    return { outcome: "reject", rule: "connector" }
  }

  if (allowlistHit(request, context.nodeAllowlist)) {
    return { outcome: "allow_once", rule: "allowlist" }
  }

  if (context.rememberedAllowAlways.includes(request.tool)) {
    return { outcome: "allow_always", rule: "remembered" }
  }

  return { outcome: "ask", rule: "ask" }
}
