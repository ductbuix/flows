import { describe, expect, it } from "vitest"
import {
  allowAlwaysSettingsKey,
  decidePermission,
  normalizePermissionPath,
  parseAllowAlwaysTools,
  serializeAllowAlwaysTools,
  withAllowAlwaysTool,
  type PermissionContext,
  type PermissionDecision,
  type PermissionRequest,
} from "./permission-policy.ts"

const baseCtx = (
  overrides: Partial<PermissionContext> = {}
): PermissionContext => ({
  allowedRoots: ["/work/step"],
  connectorWriteEnabled: false,
  nodeAllowlist: [],
  rememberedAllowAlways: [],
  ...overrides,
})

describe("decidePermission", () => {
  it.each<{
    name: string
    request: PermissionRequest
    context: PermissionContext
    expected: PermissionDecision
  }>([
    {
      name: "path: write outside roots rejects",
      request: { tool: "fs.write_text_file", writePath: "/etc/passwd" },
      context: baseCtx(),
      expected: { outcome: "reject", rule: "path" },
    },
    {
      name: "path: .. escape outside roots rejects",
      request: {
        tool: "fs.write_text_file",
        writePath: "/work/step/../../etc/passwd",
      },
      context: baseCtx(),
      expected: { outcome: "reject", rule: "path" },
    },
    {
      name: "path: write under work dir continues (falls to ask)",
      request: {
        tool: "fs.write_text_file",
        writePath: "/work/step/out.txt",
      },
      context: baseCtx(),
      expected: { outcome: "ask", rule: "ask" },
    },
    {
      name: "path: write under card asset root continues",
      request: {
        tool: "fs.write_text_file",
        writePath: "/cards/demo/assets/a.txt",
      },
      context: baseCtx({
        allowedRoots: ["/work/step", "/cards/demo/assets"],
      }),
      expected: { outcome: "ask", rule: "ask" },
    },
    {
      name: "connector: write capability off rejects",
      request: { tool: "github.pr_create", connectorWrite: true },
      context: baseCtx({ connectorWriteEnabled: false }),
      expected: { outcome: "reject", rule: "connector" },
    },
    {
      name: "connector: write capability on continues (falls to ask)",
      request: { tool: "github.pr_create", connectorWrite: true },
      context: baseCtx({ connectorWriteEnabled: true }),
      expected: { outcome: "ask", rule: "ask" },
    },
    {
      name: "connector: non-write does not decide",
      request: { tool: "rally.artifact_read", connectorWrite: false },
      context: baseCtx({ connectorWriteEnabled: false }),
      expected: { outcome: "ask", rule: "ask" },
    },
    {
      name: "allowlist: tool listed allows once",
      request: { tool: "Bash" },
      context: baseCtx({ nodeAllowlist: ["Bash"] }),
      expected: { outcome: "allow_once", rule: "allowlist" },
    },
    {
      name: "allowlist: toolKind listed allows once",
      request: { tool: "bash-1", toolKind: "Bash" },
      context: baseCtx({ nodeAllowlist: ["Bash"] }),
      expected: { outcome: "allow_once", rule: "allowlist" },
    },
    {
      name: "remembered: prior allow_always allows",
      request: { tool: "Edit" },
      context: baseCtx({ rememberedAllowAlways: ["Edit"] }),
      expected: { outcome: "allow_always", rule: "remembered" },
    },
    {
      name: "ask: nothing matches",
      request: { tool: "UnknownTool" },
      context: baseCtx(),
      expected: { outcome: "ask", rule: "ask" },
    },
    {
      name: "order: path beats allowlist and remembered",
      request: {
        tool: "Edit",
        writePath: "/tmp/escape.txt",
      },
      context: baseCtx({
        nodeAllowlist: ["Edit"],
        rememberedAllowAlways: ["Edit"],
      }),
      expected: { outcome: "reject", rule: "path" },
    },
    {
      name: "order: connector beats allowlist and remembered",
      request: { tool: "github.pr_create", connectorWrite: true },
      context: baseCtx({
        connectorWriteEnabled: false,
        nodeAllowlist: ["github.pr_create"],
        rememberedAllowAlways: ["github.pr_create"],
      }),
      expected: { outcome: "reject", rule: "connector" },
    },
    {
      name: "order: allowlist beats remembered",
      request: { tool: "Edit" },
      context: baseCtx({
        nodeAllowlist: ["Edit"],
        rememberedAllowAlways: ["Edit"],
      }),
      expected: { outcome: "allow_once", rule: "allowlist" },
    },
    {
      name: "order: path ok then connector rejects",
      request: {
        tool: "github.pr_create",
        writePath: "/work/step/pr.md",
        connectorWrite: true,
      },
      context: baseCtx({ connectorWriteEnabled: false }),
      expected: { outcome: "reject", rule: "connector" },
    },
  ])("$name", ({ request, context, expected }) => {
    expect(decidePermission(request, context)).toEqual(expected)
  })
})

describe("allow_always settings memory", () => {
  it("keys by workflow id", () => {
    expect(allowAlwaysSettingsKey("my-workflow")).toBe(
      "permission_allow_always:my-workflow"
    )
  })

  it("round-trips tools per workflow value", () => {
    const tools = withAllowAlwaysTool(["Edit"], "Bash")
    const raw = serializeAllowAlwaysTools(tools)
    expect(parseAllowAlwaysTools(raw)).toEqual(["Bash", "Edit"])
  })

  it("tolerates missing or bad settings values", () => {
    expect(parseAllowAlwaysTools(null)).toEqual([])
    expect(parseAllowAlwaysTools(undefined)).toEqual([])
    expect(parseAllowAlwaysTools("")).toEqual([])
    expect(parseAllowAlwaysTools("{")).toEqual([])
    expect(parseAllowAlwaysTools("42")).toEqual([])
  })

  it("withAllowAlwaysTool is idempotent", () => {
    expect(withAllowAlwaysTool(["Edit"], "Edit")).toEqual(["Edit"])
  })
})

describe("normalizePermissionPath", () => {
  it("resolves .. and separators", () => {
    expect(normalizePermissionPath("/work/step/../step/a.txt")).toBe(
      "/work/step/a.txt"
    )
    expect(normalizePermissionPath("C:\\work\\a")).toBe("C:/work/a")
  })
})
