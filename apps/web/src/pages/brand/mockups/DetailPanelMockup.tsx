import { useState, type ReactNode } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
} from "@workspace/ui/components/item"
import { Separator } from "@workspace/ui/components/separator"
import { Switch } from "@workspace/ui/components/switch"
import { BarChart3, LayoutGrid, Pencil, Play, Plug, Trash2 } from "lucide-react"
import { StatusPill } from "@/components/brand/StatusPill"
import type { Mockup } from "../types"

/** One fact: muted label left, value right (ui Item). */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Item className="px-0 py-1.5">
      <ItemContent>
        <ItemDescription>{label}</ItemDescription>
      </ItemContent>
      <ItemActions>{children}</ItemActions>
    </Item>
  )
}

/** Right panel of a workflow: on/off, run now, facts, notify, delete. */
export function DetailPanelMockup() {
  const [on, setOn] = useState(true)
  const [finish, setFinish] = useState(true)
  const [fails, setFails] = useState(false)
  return (
    <Card className="w-full max-w-sm" data-testid="mockup-detail-panel">
      <CardHeader>
        <Field orientation="horizontal" className="w-fit">
          <Switch id="brand-on" checked={on} onCheckedChange={setOn} />
          <FieldLabel htmlFor="brand-on">{on ? "On" : "Off"}</FieldLabel>
        </Field>
        <CardAction className="flex gap-1">
          <Button variant="ghost">
            <Pencil /> Edit
          </Button>
          <Button variant="outline">
            <Play /> Run now
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ItemGroup className="gap-0">
          <Fact label="Next run">
            <span className="font-medium">Fri 21 Nov, 17:00</span>
          </Fact>
          <Fact label="Agent">
            <Badge variant="secondary">
              <BarChart3 className="text-info" /> Data analyst
            </Badge>
          </Fact>
          <Fact label="Posts to">
            <Badge variant="secondary">
              <LayoutGrid /> Portfolio launch
            </Badge>
          </Fact>
          <Fact label="Uses">
            <Badge variant="secondary">
              <Plug /> Plausible
            </Badge>
            <StatusPill tone="attention">Needs sign-in</StatusPill>
          </Fact>
        </ItemGroup>
        <Separator />
        <FieldSet>
          <FieldLegend variant="label">Notify me</FieldLegend>
          <FieldGroup className="gap-3">
            <Field orientation="horizontal">
              <FieldLabel htmlFor="brand-finish" className="font-normal">
                When it finishes
              </FieldLabel>
              <Switch id="brand-finish" checked={finish} onCheckedChange={setFinish} />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="brand-fails" className="font-normal">
                Only if it fails
              </FieldLabel>
              <Switch id="brand-fails" checked={fails} onCheckedChange={setFails} />
            </Field>
          </FieldGroup>
        </FieldSet>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" className="text-muted-foreground">
          <Trash2 /> Delete workflow
        </Button>
      </CardFooter>
    </Card>
  )
}

export const detailPanelMockup: Mockup = {
  id: "detail-panel",
  title: "Detail panel",
  group: "Workflows",
  summary:
    "Right-hand panel for a workflow or node: actions, facts as rows, toggles, delete.",
  usedIn: [
    "Workflow page right column",
    "Node settings Sheet on the canvas",
    "Work item Sheet from the board",
  ],
  anatomy: [
    "Action row: on/off Switch left; Edit (ghost) and Run now (outline) right",
    "Facts: ItemGroup of Item, ItemDescription label left, ItemActions value right; linked objects as Badge secondary",
    "Problems sit inline next to the fact (Needs sign-in)",
    "FieldSet + FieldLegend (Notify me) with Field orientation=horizontal Switch rows",
    "CardFooter: Delete as a quiet ghost button",
  ],
  states: [
    "Off: label reads Off, Next run reads Paused",
    "Problem: attention pill next to the fact; clicking it fixes it (sign in)",
    "Read only (past run): no Switches or actions, same rows",
  ],
  rules: {
    do: [
      "Label left, value right, one fact per row",
      "Switches apply at once; no Save button",
      "Delete always asks in a ConfirmDialog",
    ],
    dont: [
      "Forms with inputs for facts that are links (agent, target)",
      "A red Delete button; destructive color only inside the confirm",
      "More than three groups split by separators",
    ],
  },
  parts: [
    "ui Card (Header, Action, Content, Footer), Item, Badge",
    "ui Field (FieldSet, FieldLegend, FieldLabel), Switch, Separator, Button",
    "components/brand/StatusPill",
    "components/ConfirmDialog for delete",
  ],
  Component: DetailPanelMockup,
}
