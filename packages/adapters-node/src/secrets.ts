import { randomBytes } from "node:crypto"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, isAbsolute, join, relative } from "node:path"
import { assertSecretKey, type SecretStore } from "@workspace/core/ports"

const DIR_MODE = 0o700
const FILE_MODE = 0o600

function resolveUnderRoot(root: string, key: string): string {
  assertSecretKey(key)
  const abs = join(root, key)
  const rel = relative(root, abs)
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`invalid secret key: ${key}`)
  }
  return abs
}

function writeAtomicMode(path: string, data: string, mode: number): void {
  mkdirSync(dirname(path), { recursive: true })
  chmodSync(dirname(path), DIR_MODE)
  const tmp = join(
    dirname(path),
    `.${Date.now()}-${randomBytes(4).toString("hex")}.tmp`
  )
  writeFileSync(tmp, data, { mode })
  renameSync(tmp, path)
  chmodSync(path, mode)
}

/** File-backed secrets under FLOWAPP_HOME/secrets/ (DES-041, DES-026). */
export function createNodeSecretStore(options: { root: string }): SecretStore {
  const root = options.root

  return {
    get(key: string): string | null {
      const abs = resolveUnderRoot(root, key)
      if (!existsSync(abs)) return null
      return readFileSync(abs, "utf8")
    },

    set(key: string, value: string): void {
      const abs = resolveUnderRoot(root, key)
      mkdirSync(root, { recursive: true })
      chmodSync(root, DIR_MODE)
      writeAtomicMode(abs, value, FILE_MODE)
    },

    delete(key: string): void {
      const abs = resolveUnderRoot(root, key)
      if (!existsSync(abs)) return
      unlinkSync(abs)
    },
  }
}
