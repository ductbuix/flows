import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useState } from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card"
import { Label } from "@workspace/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Confirmation } from "@workspace/ui/components/confirmation"
import { FileTree, pathsToFileTree } from "@workspace/ui/components/file-tree"
import { Plan } from "@workspace/ui/components/plan"
import { PromptInput } from "@workspace/ui/components/prompt-input"
import { StackTrace } from "@workspace/ui/components/stack-trace"
import { Terminal } from "@workspace/ui/components/terminal"
import { ModelSelector } from "@/components/ai-elements/model-selector"
import { EnvironmentVariables } from "@/components/data/EnvironmentVariables"
import { Task } from "@workspace/ui/components/task"
import { FreshnessBadge } from "@/components/data/FreshnessBadge"
import { ImpactBadge } from "@/components/data/ImpactBadge"
import { Page, PageSection, PageTitle } from "@/components/page"
import { PublishPolicyBadge } from "@/components/data/PublishPolicyBadge"
import { RunStatusBadge } from "@/components/data/RunStatusBadge"
import { mono } from "@/components/data/mono"

const RUN_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const

/** Dev-only kit of shared page patterns (DES-025). */
export function DevKitPage() {
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState<string | undefined>()
  const [effort, setEffort] = useState<"low" | "high" | undefined>()
  return (
    <Page crumbs={[{ label: "Dev kit" }]} data-testid="dev-kit">
      <PageTitle
        title="Shared patterns"
        description="Title block, status Badges, task Card, Confirmation and Plan."
        badge={<RunStatusBadge status="running" needsYou />}
      />

      <PageSection title="Run status">
        <div className="flex flex-wrap gap-2">
          {RUN_STATUSES.map((status) => (
            <RunStatusBadge
              key={status}
              status={status}
              data-testid={`kit-status-${status}`}
            />
          ))}
          <RunStatusBadge
            status="running"
            needsYou
            data-testid="kit-status-awaiting"
          />
        </div>
      </PageSection>

      <PageSection title="Impact">
        <div className="flex flex-wrap gap-2">
          <ImpactBadge impact="read" data-testid="kit-impact-read" />
          <ImpactBadge impact="local" data-testid="kit-impact-local" />
          <ImpactBadge impact="cloud" data-testid="kit-impact-cloud" />
        </div>
      </PageSection>

      <PageSection title="Freshness">
        <div className="flex flex-wrap gap-2">
          <FreshnessBadge fresh data-testid="kit-freshness-fresh" />
          <FreshnessBadge fresh={false} data-testid="kit-freshness-stale" />
        </div>
      </PageSection>

      <PageSection title="Publish policy">
        <div className="flex flex-wrap gap-2">
          <PublishPolicyBadge
            policy="read-only"
            data-testid="kit-policy-read-only"
          />
          <PublishPolicyBadge
            policy="approve-each-publish"
            data-testid="kit-policy-approve"
          />
          <PublishPolicyBadge
            policy="trust-agent-review"
            data-testid="kit-policy-agent-review"
          />
        </div>
      </PageSection>

      <PageSection title="Task Card">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle className={mono}>build</CardTitle>
            <CardDescription>Command task</CardDescription>
            <CardAction>
              <RunStatusBadge status="running" data-testid="kit-task-status" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <Task
              title="build"
              status="running"
              data-testid="kit-task"
              steps={[
                { title: "Install deps", status: undefined },
                { title: "Compile", status: "running" },
              ]}
            />
          </CardContent>
        </Card>
      </PageSection>

      <PageSection title="Confirmation">
        <Confirmation
          data-testid="kit-confirmation"
          title="Approve publish?"
          description="Reject leaves local changes unpublished."
          onApprove={() => undefined}
          onDeny={() => undefined}
        />
      </PageSection>

      <PageSection title="Plan">
        <Plan
          data-testid="kit-plan"
          title="Run plan"
          steps={[
            { title: "Fetch context", status: "done" },
            { title: "Apply workflow", status: "running" },
            { title: "Publish", status: "pending" },
          ]}
        />
      </PageSection>

      <PageSection title="shadcn parts">
        <div className="flex flex-wrap items-start gap-4" data-testid="kit-parts">
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />}>
              Popover
            </PopoverTrigger>
            <PopoverContent>Popover content</PopoverContent>
          </Popover>
          <HoverCard>
            <HoverCardTrigger render={<Button variant="link" />}>
              Hover card
            </HoverCardTrigger>
            <HoverCardContent>Hover card content</HoverCardContent>
          </HoverCard>
          <div className="flex items-center gap-2">
            <Checkbox id="kit-checkbox" data-testid="kit-checkbox" />
            <Label htmlFor="kit-checkbox">Checkbox</Label>
          </div>
          <Combobox items={["main", "develop", "release"]}>
            <ComboboxInput placeholder="Branch" data-testid="kit-combobox" />
            <ComboboxContent>
              <ComboboxEmpty>No match</ComboboxEmpty>
              <ComboboxList>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <Accordion className="w-64" data-testid="kit-accordion">
            <AccordionItem value="a">
              <AccordionTrigger>Accordion</AccordionTrigger>
              <AccordionContent>Accordion content</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </PageSection>

      <PageSection title="AI Elements">
        <div className="flex max-w-xl flex-col gap-4">
          <FileTree
            data-testid="kit-file-tree"
            roots={pathsToFileTree(["out/report.md", "out/data/a.json"])}
          />
          <PromptInput
            data-testid="kit-prompt-input"
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => undefined}
          />
          <ModelSelector
            catalog={null}
            model={model}
            effort={effort}
            onChangeModel={setModel}
            onChangeEffort={setEffort}
          />
          <StackTrace
            data-testid="kit-stack-trace"
            error="Error: boom"
            frames={["at run (src/run.ts:1:1)"]}
          />
          <Terminal
            data-testid="kit-terminal"
            title="pnpm build"
            output="done"
            defaultOpen
          />
          <EnvironmentVariables
            data-testid="kit-env"
            vars={[{ name: "RUN_INPUT", value: "{}", badge: "frozen" }]}
          />
        </div>
      </PageSection>
    </Page>
  )
}
