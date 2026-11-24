import { createHash } from "node:crypto"
import {
  canonicalManualItemPayload,
  canonicalWorkItemKeyPayload,
  type ManualItemKeyField,
} from "@workspace/contracts"

/** Hex SHA-256 of the canonical Manual item key (DES-021). */
export function manualItemKey(fields: ManualItemKeyField[]): string {
  return createHash("sha256")
    .update(canonicalManualItemPayload(fields), "utf8")
    .digest("hex")
}

/** Hex SHA-256 of a work-item-derived item key (DES-026 / BL-039). */
export function workItemItemKey(workItemId: string): string {
  return createHash("sha256")
    .update(canonicalWorkItemKeyPayload(workItemId), "utf8")
    .digest("hex")
}
