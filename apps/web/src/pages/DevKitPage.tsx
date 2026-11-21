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
import { FreshnessBadge } from "@/components/FreshnessBadge"
import { ImpactBadge } from "@/components/ImpactBadge"
import { PageHeader } from "@/components/PageHeader"
import { PageTitle } from "@/components/PageTitle"
import { PublishPolicyBadge } from "@/components/PublishPolicyBadge"
import { RunStatusBadge } from "@/components/RunStatusBadge"
import { Section } from "@/components/Section"

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
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader crumbs={[{ label: "Dev kit" }]} />
      <div
        className="flex flex-1 flex-col gap-6 overflow-auto p-6"
        data-testid="dev-kit"
      >
        <PageTitle
          title="Shared patterns"
          description="Title block, status Badges, task Card, Confirmation and Plan."
          badge={<RunStatusBadge status="running" needsYou />}
        />

        <Section title="Run status">
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
        </Section>

        <Section title="Impact">
          <div className="flex flex-wrap gap-2">
            <ImpactBadge impact="read" data-testid="kit-impact-read" />
            <ImpactBadge impact="local" data-testid="kit-impact-local" />
            <ImpactBadge impact="cloud" data-testid="kit-impact-cloud" />
          </div>
        </Section>

        <Section title="Freshness">
          <div className="flex flex-wrap gap-2">
            <FreshnessBadge fresh data-testid="kit-freshness-fresh" />
            <FreshnessBadge fresh={false} data-testid="kit-freshness-stale" />
          </div>
        </Section>

        <Section title="Publish policy">
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
        </Section>

        <Section title="Task Card">
          <Card size="sm" className="max-w-sm">
            <CardHeader>
              <CardTitle className="font-mono">build</CardTitle>
              <CardDescription>Command task</CardDescription>
              <CardAction>
                <RunStatusBadge
                  status="running"
                  data-testid="kit-task-status"
                />
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
        </Section>

        <Section title="Confirmation">
          <Confirmation
            data-testid="kit-confirmation"
            title="Approve publish?"
            description="Reject leaves local changes unpublished."
            onApprove={() => undefined}
            onDeny={() => undefined}
          />
        </Section>

        <Section title="Plan">
          <Plan
            data-testid="kit-plan"
            title="Run plan"
            steps={[
              { title: "Fetch context", status: "done" },
              { title: "Apply workflow", status: "running" },
              { title: "Publish", status: "pending" },
            ]}
          />
        </Section>
      </div>
    </div>
  )
}
