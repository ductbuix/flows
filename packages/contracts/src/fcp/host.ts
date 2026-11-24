import { z } from "zod"
import { connectorFileIdSchema } from "../connector.ts"
import { defineMethod } from "./define.ts"

/** Cookie returned by `host/browser_sign_in` (DES-040 / BL-190). */
export const hostStoredCookieSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
  domain: z.string().min(1).optional(),
  path: z.string().min(1).default("/"),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional(),
})

export type HostStoredCookie = z.infer<typeof hostStoredCookieSchema>

/** Engine → client: show a path in Finder (DES-040 `host.revealPath`). */
export const hostRevealPathParamsSchema = z.object({
  path: z.string().min(1),
})

export const hostRevealPathResultSchema = z.object({})

export const hostRevealPathMethod = defineMethod({
  name: "host/reveal_path",
  params: hostRevealPathParamsSchema,
  result: hostRevealPathResultSchema,
  kind: "command",
})

/** Engine → client: open a sign-in window and return cookies (DES-040). */
export const hostBrowserSignInParamsSchema = z.object({
  connectorId: connectorFileIdSchema,
  url: z.string().url(),
  cookieDomains: z.array(z.string().min(1)).min(1),
})

export const hostBrowserSignInResultSchema = z.union([
  z.object({
    cookies: z.array(hostStoredCookieSchema),
  }),
  z.object({
    cancelled: z.literal(true),
  }),
])

export const hostBrowserSignInMethod = defineMethod({
  name: "host/browser_sign_in",
  params: hostBrowserSignInParamsSchema,
  result: hostBrowserSignInResultSchema,
  kind: "command",
})

/** Engine-to-client host methods (not in `fcpMethodTable`). */
export const fcpHostMethodTable = {
  "host/reveal_path": hostRevealPathMethod,
  "host/browser_sign_in": hostBrowserSignInMethod,
} as const
