import { useState } from "react"
import { Plus } from "lucide-react"
import { useOptionalFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { Page, PageTitle } from "@/components/page"
import { AddSourceDialog } from "./AddSourceDialog"
import { SkillSheet } from "./SkillSheet"
import { SourcesList, useLibraryItems } from "./SkillSources"
import { SkillsEmpty, SkillsLoadError, SkillsLoading } from "./SkillsStates"
import {
  AvailableTable,
  InstalledTable,
  type AvailableRow,
  type SkillPick,
} from "./SkillsTable"

export function SkillsPage() {
  const existing = useOptionalFlowsClient()
  if (existing) return <SkillsPageInner />
  return (
    <FlowsClientGate>
      <SkillsPageInner />
    </FlowsClientGate>
  )
}

function SkillsPageInner() {
  const listQ = useQuery("skill/list", {}, { topics: ["skill"] })
  const sourcesQ = useQuery("skill/list_sources", {}, { topics: ["skill"] })
  const items = useLibraryItems()
  const [pick, setPick] = useState<SkillPick | null>(null)
  const [adding, setAdding] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const skills = listQ.data?.items ?? []
  const sources = sourcesQ.data?.items ?? []
  const available: AvailableRow[] = sources.flatMap((src) => {
    const title = items.find((i) => i.id === src.id)?.title ?? src.id
    return src.skills.map((s) => ({
      ...s,
      sourceId: src.id,
      source: title,
    }))
  })
  const updates = skills.filter((s) => {
    if (!s.from) return false
    const cur = items.find((i) => i.id === s.from?.sourceId)?.current ?? 0
    return cur > s.from.version
  }).length
  const loading = listQ.loading && !listQ.data

  if (loading) return <SkillsLoading />
  if (listQ.error && !listQ.data) return <SkillsLoadError error={listQ.error} />

  return (
    <Page
      fill
      crumbs={[{ label: "Skills" }]}
      actions={
        <Button onClick={() => setAdding(true)} data-testid="skill-source-open">
          <Plus />
          Add source
        </Button>
      }
      data-testid="skills-page"
    >
      <PageTitle
        title="Skills"
        description={`Folders with a SKILL.md that Cursor and Claude Code read themselves. Found on disk and installed from GitHub sources.${
          updates > 0
            ? ` ${updates} update${updates === 1 ? "" : "s"} available.`
            : ""
        }`}
      />
      {(conflict || actionError) && (
        <Alert variant="destructive" data-testid="skills-conflict">
          <AlertTitle>{conflict ? "Conflict" : "Could not update"}</AlertTitle>
          <AlertDescription>
            {conflict
              ? "This skill changed on disk. Close the sheet and try again."
              : actionError}
          </AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="installed">
        <TabsList>
          <TabsTrigger value="installed" data-testid="skills-tab-installed">
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
          {skills.length === 0 ? (
            <SkillsEmpty />
          ) : (
            <InstalledTable
              skills={skills}
              items={items}
              onPick={(p) => {
                setConflict(false)
                setActionError(null)
                setPick(p)
              }}
            />
          )}
        </TabsContent>
        <TabsContent value="available" className="pt-3">
          {available.length === 0 ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="skills-available-empty"
            >
              No available skills yet. Add a GitHub source that keeps skills
              under skills/.
            </p>
          ) : (
            <AvailableTable
              rows={available}
              installed={skills}
              onPick={(p) => {
                setConflict(false)
                setActionError(null)
                setPick(p)
              }}
            />
          )}
        </TabsContent>
        <TabsContent value="sources" className="pt-3">
          <SourcesList sources={sources} items={items} />
        </TabsContent>
      </Tabs>
      <SkillSheet
        pick={pick}
        skills={skills}
        items={items}
        available={available}
        onClose={() => setPick(null)}
        onConflict={() => setConflict(true)}
        onError={(message) => {
          setConflict(false)
          setActionError(message)
        }}
      />
      <AddSourceDialog
        open={adding}
        onOpenChange={setAdding}
        sourceIds={sources.map((s) => s.id)}
        items={items}
      />
    </Page>
  )
}
