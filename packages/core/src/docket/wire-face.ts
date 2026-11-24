import type { WireCardFace } from "@workspace/contracts"
import type { CardFace } from "./index.ts"

export function toWireFace(face: CardFace): WireCardFace {
  return {
    id: face.id,
    path: face.path,
    hash: face.hash,
    title: face.title,
    status: face.status,
    columnId: face.columnId,
    rank: face.rank,
    start: face.start,
    due: face.due,
    done: face.done,
    refs: face.refs,
    linkCount: face.linkCount,
    assetCount: face.assetCount,
    missingLinkedAssetCount: face.missingLinkedAssetCount,
    warnings: face.warnings,
  }
}
