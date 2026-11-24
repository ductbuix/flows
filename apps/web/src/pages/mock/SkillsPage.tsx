import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Page, PageTitle } from "@/components/page"
import { useLibrary } from "./library-store"
import { SkillSheet } from "./SkillSheet"
import { AddSourceDialog, SourcesList } from "./SkillSources"
import { AvailableTable, InstalledTable, type Pick } from "./SkillsTable"
import { skillsOf, useSkills, useSources } from "./skills-store"

export function SkillsPage() {
  const skills = useSkills()
  const sources = useSources()
  const items = useLibrary()
  const [pick, setPick] = useState<Pick | null>(null)
  const [adding, setAdding] = useState(false)
  const available = sources.flatMap((id) =>
    skillsOf(id).map((s) => ({
      ...s,
      sourceId: id,
      source: items.find((i) => i.id === id)?.title ?? id,
    }))
  )
  const updates = skills.filter(
    (s) =>
      s.from &&
      (items.find((i) => i.id === s.from?.sourceId)?.current ?? 0) >
        s.from.version
  ).length

  return (
    <Page
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Skills" }]}
      actions={
        <Button onClick={() => setAdding(true)} data-testid="skill-source-open">
          <Plus />
          Add source
        </Button>
      }
      data-testid="mock-skills-page"
    >
      <PageTitle
        title="Skills"
        description={`Folders with a SKILL.md that Cursor and Claude Code read themselves. Found on disk and installed from GitHub sources. ${updates > 0 ? `${updates} update${updates === 1 ? "" : "s"} available. ` : ""}Mock data.`}
      />
      <Tabs defaultValue="installed">
        <TabsList>
          <TabsTrigger value="installed">
            On this machine ({skills.length})
          </TabsTrigger>
          <TabsTrigger value="available" data-testid="skills-tab-available">
            Available ({available.length})
          </TabsTrigger>
          <TabsTrigger value="sources" data-testid="skills-tab-sources">
            Sources ({sources.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="installed" className="pt-3">
          <InstalledTable skills={skills} items={items} onPick={setPick} />
        </TabsContent>
        <TabsContent value="available" className="pt-3">
          <AvailableTable
            rows={available}
            installed={skills}
            onPick={setPick}
          />
        </TabsContent>
        <TabsContent value="sources" className="pt-3">
          <SourcesList />
        </TabsContent>
      </Tabs>
      <SkillSheet pick={pick} onClose={() => setPick(null)} />
      <AddSourceDialog open={adding} onOpenChange={setAdding} />
    </Page>
  )
}
