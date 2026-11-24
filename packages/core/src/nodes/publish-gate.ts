import type { ChangeSet } from "@workspace/contracts"
import type { PublishPolicy } from "../ports/publish.ts"

/** True when a person must approve before the connector send (DES-026). */
export function needsPersonGate(
  policy: PublishPolicy,
  changeSet: ChangeSet
): boolean {
  if (policy === "approve-each-publish") return true
  return changeSet.ops.some((o) => o.destructive)
}
