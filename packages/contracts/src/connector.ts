import { parse as parseYaml, stringify as stringifyYaml } from "yaml"
import { z } from "zod"
import { connectionIdSchema } from "./connection.ts"

/** Connector file id: same slug rule as connections (DES-041 / mockup). */
export const connectorFileIdSchema = connectionIdSchema

export const connectorTransportSchema = z.enum(["mcp", "api", "cli"])
export type ConnectorTransport = z.infer<typeof connectorTransportSchema>

export const connectorAuthSchema = z.enum([
  "cookies",
  "pat",
  "oauth",
  "cli-login",
  "none",
])
export type ConnectorAuth = z.infer<typeof connectorAuthSchema>

/**
 * Which transports may use which sign-ins (Connectors mockup `AUTH_FOR`).
 */
export const AUTH_FOR = {
  mcp: ["oauth", "pat", "none"],
  api: ["cookies", "pat", "oauth"],
  cli: ["cli-login", "pat"],
} as const satisfies Record<ConnectorTransport, readonly ConnectorAuth[]>

/**
 * One capability switch. Writes default off; when `write` is true and
 * `allowed` is omitted, `allowed` becomes false (mockup / DES-041).
 * `cmd` is the argv after `how` for cli transport (BL-161); data in the
 * connector file, not hard-coded per capability name.
 */
export const capabilitySchema = z
  .object({
    name: z.string().min(1),
    desc: z.string().default(""),
    write: z.boolean().default(false),
    allowed: z.boolean().optional(),
    cmd: z.array(z.string().min(1)).optional(),
  })
  .transform((c) => ({
    name: c.name,
    desc: c.desc,
    write: c.write,
    allowed: c.allowed ?? !c.write,
    ...(c.cmd !== undefined ? { cmd: c.cmd } : {}),
  }))

export type Capability = z.infer<typeof capabilitySchema>

const connectorFieldsSchema = z.strictObject({
  id: connectorFileIdSchema,
  name: z.string().min(1),
  transport: connectorTransportSchema,
  /** Command, URL or binary. */
  how: z.string().min(1),
  auth: connectorAuthSchema,
  capabilities: z.array(capabilitySchema).default([]),
  providerId: z.string().min(1).optional(),
})

/**
 * `connectors/<id>.yaml` shape. Strict so secret keys (`token`,
 * `password`, `cookie`) and any other unknown field are rejected
 * (DES-041: secrets only in SecretStore). Auth must be in `AUTH_FOR`
 * for the transport.
 */
export const connectorSchema = connectorFieldsSchema.superRefine((val, ctx) => {
  const allowed = AUTH_FOR[val.transport] as readonly string[]
  if (!allowed.includes(val.auth)) {
    ctx.addIssue({
      code: "custom",
      message: `auth "${val.auth}" is not allowed for transport "${val.transport}"`,
      path: ["auth"],
    })
  }
})

export type ConnectorFile = z.infer<typeof connectorSchema>
export type ConnectorFileInput = z.input<typeof connectorFieldsSchema>

/** List row: no capability body (DES-040 summaries in lists). */
export const connectorSummarySchema = z.object({
  id: connectorFileIdSchema,
  name: z.string().min(1),
  transport: connectorTransportSchema,
  how: z.string().min(1),
  auth: connectorAuthSchema,
  providerId: z.string().min(1).optional(),
})

export type ConnectorSummary = z.infer<typeof connectorSummarySchema>

export function toConnectorSummary(c: ConnectorFile): ConnectorSummary {
  return {
    id: c.id,
    name: c.name,
    transport: c.transport,
    how: c.how,
    auth: c.auth,
    ...(c.providerId !== undefined ? { providerId: c.providerId } : {}),
  }
}

export function parseConnectorYaml(text: string): ConnectorFile {
  const raw = parseYaml(text) ?? {}
  return connectorSchema.parse(raw)
}

export function safeParseConnectorYaml(text: string) {
  try {
    const raw = parseYaml(text) ?? {}
    return connectorSchema.safeParse(raw)
  } catch (err) {
    return connectorSchema.safeParse({
      __yamlError: err instanceof Error ? err.message : "invalid YAML",
    })
  }
}

export function connectorToYaml(connector: ConnectorFile): string {
  return stringifyYaml(connector, { lineWidth: 0 })
}
