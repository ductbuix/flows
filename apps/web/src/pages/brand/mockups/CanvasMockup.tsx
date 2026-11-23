import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  ButtonGroup,
  ButtonGroupText,
} from "@workspace/ui/components/button-group"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import {
  Bot,
  RotateCcw,
  Maximize2,
  Minus,
  Plus,
  Send,
  ShieldCheck,
  Zap,
} from "lucide-react"
import type { Mockup } from "../types"
import { CanvasNode, EdgeLabel, Wire } from "./CanvasNode"

/** A workflow on the canvas: trigger, agent, a judge split, two ends. */
export function CanvasMockup() {
  const [view, setView] = useState<string[]>(["outline"])
  return (
    <div
      className="relative flex w-full max-w-3xl flex-col items-center rounded-2xl border bg-background bg-dot-grid px-4 pt-8 pb-20"
      data-testid="mockup-canvas"
    >
      <div className="flex flex-col items-center gap-1.5">
        <EdgeLabel>When this happens</EdgeLabel>
        <CanvasNode
          icon={<Zap />}
          kind="info"
          title="New Rally story"
          subtitle="Starts at once"
          inset={
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">INPUT</span>
              <span>Stories tagged release in project Flows</span>
            </div>
          }
        />
      </div>
      <Wire />
      <div className="flex flex-col items-center gap-1.5">
        <EdgeLabel tone="info">Do this</EdgeLabel>
        <CanvasNode
          icon={<Bot />}
          title="Draft the change"
          subtitle="Claude Code · high effort"
          selected
          inset="Read the story, change the code, open a draft PR."
        />
      </div>
      <Wire />
      <CanvasNode
        icon={<ShieldCheck />}
        kind="warning"
        title="Review the diff"
        subtitle="Judge · passes when tests are green"
      />
      <Wire className="h-4" />
      <div aria-hidden className="h-4 w-80 rounded-t-xl border-x border-t" />
      <div className="flex w-full justify-center gap-6">
        <div className="flex flex-col items-center gap-1.5">
          <EdgeLabel tone="success">Pass</EdgeLabel>
          <CanvasNode
            icon={<Send />}
            kind="success"
            title="Publish the PR"
            subtitle="Needs your approval"
            className="w-56"
          />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <EdgeLabel tone="destructive">Fail</EdgeLabel>
          <CanvasNode
            icon={<RotateCcw />}
            title="Back to Draft"
            subtitle="Loops at most 3 times"
            className="w-56"
          />
        </div>
      </div>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl border bg-background p-1 shadow-sm">
        <ToggleGroup value={view} onValueChange={setView}>
          <ToggleGroupItem value="outline">Outline</ToggleGroupItem>
          <ToggleGroupItem value="details">Details</ToggleGroupItem>
        </ToggleGroup>
        <ButtonGroup>
          <Button variant="ghost" size="icon" aria-label="Zoom out">
            <Minus />
          </Button>
          <ButtonGroupText className="border-0 bg-transparent tabular-nums">
            100%
          </ButtonGroupText>
          <Button variant="ghost" size="icon" aria-label="Zoom in">
            <Plus />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Fit view">
            <Maximize2 />
          </Button>
        </ButtonGroup>
      </div>
    </div>
  )
}

export const canvasMockup: Mockup = {
  id: "canvas",
  title: "Workflow canvas",
  group: "Workflows",
  summary:
    "The Workflows page editor: nodes top to bottom on a dot grid, labeled edges.",
  usedIn: ["/workflows/:id Editor tab", "Past run canvas (read only)"],
  anatomy: [
    "Dot grid backdrop (bg-dot-grid) on bg-background",
    "Edge label: ui Badge outline above the first node (When this happens) and actions (Do this)",
    "Node: ui Card size=sm with KindAvatar, CardTitle, CardDescription, optional muted inset",
    "Branches: elbow split, each branch topped by its label (Pass / Fail)",
    "Floating toolbar bottom center: Outline/Details, zoom, fit",
  ],
  states: [
    "Selected: ring-info/40; the detail panel opens on the right",
    "Running (run view): the node tile turns into a spinner, wire in info",
    "Done / failed: the node gets a status pill in its header",
    "Needs you: warning tile + attention pill on the node",
  ],
  rules: {
    do: [
      "Flow runs top to bottom; branches spread sideways",
      "Name nodes with a verb phrase: Draft the change, Review the diff",
      "Avatar tint = node kind: trigger info, approval/judge warning, output success, others soft",
      "Edge labels say the condition in one or two words",
    ],
    dont: [
      "More than one line of muted text under a node name",
      "Colored wires except while a run is live",
      "Settings forms inside nodes; they live in the right panel",
    ],
  },
  parts: [
    "@xyflow/react for the real canvas (Controls, Panel, Background); nodes/NodeFrame",
    "ui Card size=sm, ui Badge, ui Avatar via components/brand/KindAvatar",
    "ui ToggleGroup, ButtonGroup, Button ghost icon",
  ],
  Component: CanvasMockup,
}
