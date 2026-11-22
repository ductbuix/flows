import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Confirmation } from "@/components/ai-elements/confirmation"
import { Plan } from "@/components/ai-elements/plan"
import { Task } from "@/components/ai-elements/task"
import { FreshnessBadge } from "@/components/data/FreshnessBadge"
import { ImpactBadge } from "@/components/data/ImpactBadge"
import { Page, PageSection, PageTitle } from "@/components/page"
import { PublishPolicyBadge } from "@/components/data/PublishPolicyBadge"
import { RunStatusBadge } from "@/components/data/RunStatusBadge"

const RUN_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const

/** Dev-only kit of shared page patterns (DES-025). */
export function DevKitPage() {
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
        <Card size="sm" className="max-w-sm">
          <CardHeader>
            <CardTitle className="font-mono">build</CardTitle>
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
    </Page>
  )
}
