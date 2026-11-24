import { z } from "zod"
import {
  cliStatusSchema,
  putTrustBodySchema,
  trustStatusSchema,
} from "../api-trust.ts"
import {
  mcpTrustStatusSchema,
  putMcpTrustBodySchema,
} from "../api-mcp-trust.ts"
import { defineMethod } from "./define.ts"

/** Read-only agent CLI probe (DES-024 / BL-210). */
export const settingsCliStatusParamsSchema = z.object({})
export const settingsCliStatusResultSchema = cliStatusSchema

export const settingsCliStatusMethod = defineMethod({
  name: "settings/cli_status",
  params: settingsCliStatusParamsSchema,
  result: settingsCliStatusResultSchema,
  kind: "query",
})

/** Always-trust status for this app home (DES-019 / BL-210). */
export const settingsGetTrustParamsSchema = z.object({})
export const settingsGetTrustResultSchema = trustStatusSchema

export const settingsGetTrustMethod = defineMethod({
  name: "settings/get_trust",
  params: settingsGetTrustParamsSchema,
  result: settingsGetTrustResultSchema,
  kind: "query",
})

export const settingsSetTrustParamsSchema = putTrustBodySchema
export const settingsSetTrustResultSchema = trustStatusSchema

export const settingsSetTrustMethod = defineMethod({
  name: "settings/set_trust",
  params: settingsSetTrustParamsSchema,
  result: settingsSetTrustResultSchema,
  kind: "command",
})

/** MCP server allow list (DES-026 / BL-210). */
export const settingsListMcpTrustParamsSchema = z.object({})
export const settingsListMcpTrustResultSchema = mcpTrustStatusSchema

export const settingsListMcpTrustMethod = defineMethod({
  name: "settings/list_mcp_trust",
  params: settingsListMcpTrustParamsSchema,
  result: settingsListMcpTrustResultSchema,
  kind: "query",
})

export const settingsSetMcpTrustParamsSchema = putMcpTrustBodySchema
export const settingsSetMcpTrustResultSchema = mcpTrustStatusSchema

export const settingsSetMcpTrustMethod = defineMethod({
  name: "settings/set_mcp_trust",
  params: settingsSetMcpTrustParamsSchema,
  result: settingsSetMcpTrustResultSchema,
  kind: "command",
})
