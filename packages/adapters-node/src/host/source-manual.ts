import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import {
  applyInputDefaults,
  normalizeInputText,
  type ManualItemKeyField,
  type WorkflowInputDecl,
} from "@workspace/contracts"

export type ManualFilePart = {
  field: string
  basename: string
  data: Buffer
}

export type ManualItem = {
  decls: WorkflowInputDecl[]
  values: Record<string, string | undefined>
  files: ManualFilePart[]
}

export type InputsJsonField =
  { type: "text" | "markdown"; value: string } | { type: "file"; path: string }

export type InputsJson = {
  source: "manual"
  itemKey: string
  itemKeyVersion: 1
  fields: Record<string, InputsJsonField>
  cardId?: string
}

export type MaterializeResult = {
  fields: ManualItemKeyField[]
  inputsJson: Omit<InputsJson, "itemKey" | "itemKeyVersion">
}

/**
 * Manual source adapter: one Start-run form item into the run input dir
 * (DES-021). Caller copies WF_INPUT first and writes inputs.json after.
 */
export const manualSource = {
  id: "manual" as const,
  materialize(item: ManualItem, destDir: string): MaterializeResult {
    const resolved = applyInputDefaults(item.decls, item.values)
    const keyFields: ManualItemKeyField[] = []
    const fields: Record<string, InputsJsonField> = {}
    const byName = new Map(item.decls.map((d) => [d.name, d]))

    for (const decl of item.decls) {
      if (decl.type === "file") {
        const part = item.files.find((f) => f.field === decl.name)
        if (!part) continue
        const safeName = basename(part.basename)
        const rel = join(decl.name, safeName)
        const abs = join(destDir, decl.name, safeName)
        mkdirSync(join(destDir, decl.name), { recursive: true })
        writeFileSync(abs, part.data)
        const sha256 = createHash("sha256").update(part.data).digest("hex")
        keyFields.push({ name: decl.name, type: "file", sha256 })
        fields[decl.name] = { type: "file", path: rel }
        continue
      }
      const raw = resolved[decl.name]
      if (raw === undefined) continue
      const text = normalizeInputText(decl.type, raw)
      const rel = `${decl.name}.${decl.type === "markdown" ? "md" : "txt"}`
      writeFileSync(join(destDir, rel), text, "utf8")
      keyFields.push({ name: decl.name, type: decl.type, text })
      fields[decl.name] = { type: decl.type, value: text }
    }

    // Undeclared attachments when there is no inputs list, or extra attach parts.
    for (const part of item.files) {
      if (byName.has(part.field) && byName.get(part.field)?.type === "file") {
        continue
      }
      if (part.field !== "attach" && byName.size > 0) continue
      const safeName = basename(part.basename)
      const rel = join("attach", safeName)
      mkdirSync(join(destDir, "attach"), { recursive: true })
      writeFileSync(join(destDir, "attach", safeName), part.data)
      const sha256 = createHash("sha256").update(part.data).digest("hex")
      keyFields.push({ name: `attach/${safeName}`, type: "file", sha256 })
      fields[`attach/${safeName}`] = { type: "file", path: rel }
    }

    return {
      fields: keyFields,
      inputsJson: { source: "manual", fields },
    }
  },
}
