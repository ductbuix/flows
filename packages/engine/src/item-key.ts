import { createHash } from "node:crypto"
import {
  canonicalManualItemPayload,
  canonicalCardKeyPayload,
  type ManualItemKeyField,
} from "@workspace/contracts"

/** Hex SHA-256 of the canonical Manual item key (DES-021). */
export function manualItemKey(fields: ManualItemKeyField[]): string {
  return createHash("sha256")
    .update(canonicalManualItemPayload(fields), "utf8")
    .digest("hex")
}

/** Hex SHA-256 of a card-derived item key (DES-038 / BL-039). */
export function cardItemKey(cardId: string): string {
  return createHash("sha256")
    .update(canonicalCardKeyPayload(cardId), "utf8")
    .digest("hex")
}
