import type { DatabaseSync } from "node:sqlite"
import { cliTrustValueSchema, type CliTrustValue } from "@workspace/shared"

export type { CliTrustValue }

export const CLI_TRUST_KEY = "cli_trust"

/** Ensure the settings table exists beside events (DES-003). */
export function ensureSettingsTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `)
}

export function getSetting(db: DatabaseSync, key: string): string | null {
  const row = db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(db: DatabaseSync, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}

export function deleteSetting(db: DatabaseSync, key: string): void {
  db.prepare(`DELETE FROM settings WHERE key = ?`).run(key)
}

export function readCliTrust(db: DatabaseSync): CliTrustValue | null {
  const raw = getSetting(db, CLI_TRUST_KEY)
  if (!raw) return null
  try {
    return cliTrustValueSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeCliTrust(db: DatabaseSync, value: CliTrustValue): void {
  setSetting(db, CLI_TRUST_KEY, JSON.stringify(value))
}

export function clearCliTrust(db: DatabaseSync): void {
  deleteSetting(db, CLI_TRUST_KEY)
}
