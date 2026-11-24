import { parse as parseYaml, stringify as stringifyYaml } from "yaml"
import { z } from "zod"
import { LibItemId } from "./ids.ts"
import { providerIconSchema } from "./provider.ts"

/** One immutable pull of a library item (DES-039 / DES-041). */
export const libVersionSchema = z.object({
  n: z.number().int().positive(),
  at: z.string().min(1),
  note: z.string(),
  contentHash: z.string().min(1),
})

export type LibVersion = z.infer<typeof libVersionSchema>

/** Tag shape `namespace:value` (BL-173 / Library mockup). */
export const libTagSchema = z
  .string()
  .regex(/^[^:\s]+:.+$/, "tag must be namespace:value")

export type LibTag = z.infer<typeof libTagSchema>

/** On-disk `item.yaml` (versions live under `v<n>/`). */
export const libItemDiskSchema = z.object({
  id: LibItemId,
  kind: providerIconSchema,
  title: z.string().min(1),
  /** Provider id; `local` means never fetched. */
  source: z.string().min(1),
  remoteId: z.string().min(1).optional(),
  remoteUrl: z.string().min(1).optional(),
  tags: z.array(libTagSchema).default([]),
  /** Version tasks read; newest unless pinned older. */
  current: z.number().int().positive(),
})

export type LibItemDisk = z.infer<typeof libItemDiskSchema>

/** Wire LibItem: disk fields plus discovered versions (newest first). */
export const libItemSchema = libItemDiskSchema.extend({
  versions: z.array(libVersionSchema),
})

export type LibItem = z.infer<typeof libItemSchema>

export function parseLibItemYaml(text: string): LibItemDisk {
  return libItemDiskSchema.parse(parseYaml(text) ?? {})
}

export function safeParseLibItemYaml(text: string) {
  try {
    return libItemDiskSchema.safeParse(parseYaml(text) ?? {})
  } catch (err) {
    return libItemDiskSchema.safeParse({
      __yamlError: err instanceof Error ? err.message : "invalid YAML",
    })
  }
}

export function libItemToYaml(item: LibItemDisk): string {
  return stringifyYaml(item, { lineWidth: 0 })
}

export const libVersionMetaSchema = z.object({
  n: z.number().int().positive(),
  at: z.string().min(1),
  note: z.string(),
  contentHash: z.string().min(1),
})

export type LibVersionMeta = z.infer<typeof libVersionMetaSchema>

export function parseLibVersionMetaYaml(text: string): LibVersionMeta {
  return libVersionMetaSchema.parse(parseYaml(text) ?? {})
}

export function libVersionMetaToYaml(meta: LibVersionMeta): string {
  return stringifyYaml(meta, { lineWidth: 0 })
}
