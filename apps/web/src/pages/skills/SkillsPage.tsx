import { useState } from "react"
import { useOptionalFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { Page, PageTitle } from "@/components/page"
import { SkillSheet } from "./SkillSheet"
import { SkillsEmpty, SkillsLoadError, SkillsLoading } from "./SkillsStates"
import { InstalledTable, type SkillPick } from "./SkillsTable"

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
  const [pick, setPick] = useState<SkillPick | null>(null)
  const [conflict, setConflict] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const skills = listQ.data?.items ?? []
  const loading = listQ.loading && !listQ.data

  if (loading) return <SkillsLoading />
  if (listQ.error && !listQ.data) return <SkillsLoadError error={listQ.error} />

  return (
    <Page
      fill
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Skills" }]}
      data-testid="mock-skills-page"
    >
      <PageTitle
        title="Skills"
        description="Folders with a SKILL.md that Cursor and Claude Code read themselves. Found on disk and installed from GitHub sources."
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
            Available (0)
          </TabsTrigger>
          <TabsTrigger value="sources" data-testid="skills-tab-sources">
            Sources (0)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="installed" className="pt-3">
          {skills.length === 0 ? (
            <SkillsEmpty />
          ) : (
            <InstalledTable
              skills={skills}
              onPick={(p) => {
                setConflict(false)
                setActionError(null)
                setPick(p)
              }}
            />
          )}
        </TabsContent>
        <TabsContent value="available" className="pt-3">
          <p
            className="text-sm text-muted-foreground"
            data-testid="skills-available-empty"
          >
            No available skills yet. Skill sources land with the Library page on
            the sdk.
          </p>
        </TabsContent>
        <TabsContent value="sources" className="pt-3">
          <p
            className="text-sm text-muted-foreground"
            data-testid="skill-sources"
          >
            No sources yet. Add a GitHub repo that keeps skills under skills/
            once Library items are on the sdk.
          </p>
        </TabsContent>
      </Tabs>
      <SkillSheet
        pick={pick}
        skills={skills}
        onClose={() => setPick(null)}
        onConflict={() => setConflict(true)}
        onError={(message) => {
          setConflict(false)
          setActionError(message)
        }}
      />
    </Page>
  )
}
