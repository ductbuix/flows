import { canvasMockup } from "./mockups/CanvasMockup"
import { createFormMockup } from "./mockups/CreateFormMockup"
import { detailPanelMockup } from "./mockups/DetailPanelMockup"
import { kanbanMockup } from "./mockups/KanbanMockup"
import { runCardMockup } from "./mockups/RunCardMockup"
import { statusMockup } from "./mockups/StatusMockup"
import type { Mockup } from "./types"

export type { Mockup, MockupGroup } from "./types"

/** Order here is the order on /brand. Each spec lives next to its mockup. */
export const MOCKUPS: Mockup[] = [
  statusMockup,
  createFormMockup,
  kanbanMockup,
  canvasMockup,
  runCardMockup,
  detailPanelMockup,
]

export function findMockup(id: string | undefined) {
  return MOCKUPS.find((m) => m.id === id)
}
