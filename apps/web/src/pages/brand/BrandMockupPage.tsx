import { useParams } from "react-router"
import { Check, X } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { mono } from "@/components/data/mono"
import { Page, PageSection, PageTitle } from "@/components/page"
import { findMockup } from "./registry"

function List({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul"
  return (
    <Tag
      className={
        ordered
          ? "flex list-decimal flex-col gap-1.5 pl-5 text-sm"
          : "flex list-disc flex-col gap-1.5 pl-5 text-sm"
      }
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </Tag>
  )
}

function RuleList({ items, ok }: { items: string[]; ok: boolean }) {
  const Icon = ok ? Check : X
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <Icon
            className={
              ok
                ? "mt-0.5 size-4 shrink-0 text-success"
                : "mt-0.5 size-4 shrink-0 text-destructive"
            }
          />
          {item}
        </li>
      ))}
    </ul>
  )
}

/** /brand/:mockupId: one mockup centered on a canvas, then its rules. */
export function BrandMockupPage() {
  const { mockupId } = useParams()
  const mockup = findMockup(mockupId)
  const crumbs = [
    { label: "Brand", to: "/brand" },
    { label: mockup?.title ?? "Not found" },
  ]
  if (!mockup) {
    return (
      <Page crumbs={crumbs}>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No mockup named {mockupId}</EmptyTitle>
            <EmptyDescription>Pick one from the Brand page.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Page>
    )
  }
  const { Component } = mockup
  return (
    <Page crumbs={crumbs} data-testid={`brand-mockup-${mockup.id}`}>
      <PageTitle
        title={mockup.title}
        description={mockup.summary}
        badge={<Badge variant="secondary">{mockup.group}</Badge>}
      />
      <div
        data-bleed
        data-testid="brand-stage"
        className="flex min-h-96 shrink-0 items-center justify-center border-y bg-muted/60 bg-dot-grid px-4 py-12"
      >
        <Component />
      </div>
      <div className="grid gap-8 @4xl/main:grid-cols-2">
        <PageSection title="Anatomy">
          <List items={mockup.anatomy} ordered />
        </PageSection>
        <PageSection title="States">
          <List items={mockup.states} />
        </PageSection>
        <PageSection title="Do">
          <RuleList items={mockup.rules.do} ok />
        </PageSection>
        <PageSection title="Don't">
          <RuleList items={mockup.rules.dont} ok={false} />
        </PageSection>
        <PageSection title="Build from">
          <ul className="flex flex-col gap-1.5 text-sm">
            {mockup.parts.map((p) => (
              <li key={p} className={mono}>
                {p}
              </li>
            ))}
          </ul>
        </PageSection>
        <PageSection title="Used in">
          <List items={mockup.usedIn} />
        </PageSection>
      </div>
    </Page>
  )
}
