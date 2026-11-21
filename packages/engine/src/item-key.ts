import { createHash } from "node:crypto"
import {
  canonicalManualItemPayload,
  type ManualItemKeyField,
} from "@workspace/shared"

/** Hex SHA-256 of the canonical Manual item key (DES-021). */
export function manualItemKey(fields: ManualItemKeyField[]): string {
  return createHash("sha256")
    .update(canonicalManualItemPayload(fields), "utf8")
    .digest("hex")
}
