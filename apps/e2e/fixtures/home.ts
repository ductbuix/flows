import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { seedFakeCli, seedGhStub } from "./home/bin"
import { seedConnectors } from "./home/connectors"
import { seedDocket } from "./home/docket"
import { seedLibraryItems } from "./home/library"
import { seedRepoTeamSkills } from "./home/library-skills"
import { seedAcpWorkflows } from "./home/workflows-acp"
import { seedAssetWorkflows } from "./home/workflows-assets"
import { seedCanvasWorkflows } from "./home/workflows-canvas"
import { seedGateWorkflows } from "./home/workflows-gates"
import { seedJudgeWorkflows } from "./home/workflows-judge"
import { seedLlmWorkflows, seedAnswersWorkflows } from "./home/workflows-llm"
import { seedLoopWorkflows } from "./home/workflows-loop"
import {
  seedNoTriggerRun,
  seedRunWorkflows,
  seedSheetDelete,
} from "./home/workflows-run"
import {
  seedSkillSources,
  seedSkillUses,
  seedWorkspaceSkills,
} from "./home/skills"

/** Temp FLOWAPP_HOME with the node workflow fixtures (DES-037, BL-096). */
export function createE2eHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-e2e-nodes-"))
  seedCanvasWorkflows(home)
  seedRunWorkflows(home)
  seedJudgeWorkflows(home)
  seedGateWorkflows(home)
  seedAssetWorkflows(home)
  seedLoopWorkflows(home)
  seedFakeCli(home)
  seedLlmWorkflows(home)
  seedAcpWorkflows(home)
  seedSheetDelete(home)
  seedAnswersWorkflows(home)
  seedNoTriggerRun(home)
  seedDocket(home)
  seedConnectors(home)
  seedGhStub(home)
  seedLibraryItems(home)
  seedWorkspaceSkills(home)
  seedRepoTeamSkills(home)
  seedSkillSources(home)
  seedSkillUses(home)
  return home
}
