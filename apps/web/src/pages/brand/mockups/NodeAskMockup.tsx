import { Check, CircleHelp, ShieldCheck, Wrench, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item"
import { KindAvatar } from "@/components/brand/KindAvatar"
import { StatusPill } from "@/components/brand/StatusPill"
import type { Mockup } from "../types"
import { ASKS, type Ask, type AskKind } from "./node-ask-data"

const NODE_ICON: Record<AskKind, typeof ShieldCheck> = {
  approval: ShieldCheck,
  permission: Wrench,
  question: CircleHelp,
}

/** Same markup as the canvas NodeInboxPrompt, fed with sample data. */
function AskPrompt({ ask }: { ask: Ask }) {
  return (
    <Item
      variant="outline"
      size="sm"
      className="flex-col items-stretch bg-warning/15 ring-warning/25"
      data-testid={`node-ask-prompt-${ask.kind}`}
    >
      <ItemContent>
        <ItemTitle>{ask.question}</ItemTitle>
        {ask.tool ? <ItemDescription>Tool: {ask.tool}</ItemDescription> : null}
      </ItemContent>
      <ItemActions className="flex-wrap">
        {ask.options.length > 0 ? (
          ask.options.map((o) => (
            <Button key={o.label} variant={o.ok ? "default" : "outline"}>
              {o.ok ? <Check /> : o.label.startsWith("Reject") ? <X /> : null}
              {o.label}
            </Button>
          ))
        ) : (
          <Button>Answer in Inbox</Button>
        )}
      </ItemActions>
    </Item>
  )
}

/** Asks on canvas nodes: approval, permission (3 options), other kind. */
export function NodeAskMockup() {
  return (
    <div className="grid w-full max-w-xl gap-4" data-testid="mockup-node-ask">
      {ASKS.map((ask) => {
        const Icon = NODE_ICON[ask.kind]
        return (
          <Card
            key={ask.kind}
            size="sm"
            className="w-full"
            data-testid={`node-ask-${ask.kind}`}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <KindAvatar kind="soft" size="sm">
                  <Icon />
                </KindAvatar>
                <div className="flex flex-col gap-0.5">
                  <CardTitle>{ask.nodeName}</CardTitle>
                  <CardDescription>{ask.subtitle}</CardDescription>
                </div>
              </div>
              <CardAction>
                <StatusPill tone="attention">Needs you</StatusPill>
              </CardAction>
            </CardHeader>
            <CardContent>
              <AskPrompt ask={ask} />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export const nodeAskMockup: Mockup = {
  id: "node-ask",
  title: "Node ask",
  group: "Workflows",
  summary:
    "An open ask sits on its canvas node and is answered in place, or in the Inbox.",
  usedIn: ["Workflow canvas, node with an open ask"],
  anatomy: [
    "Node Card size=sm: KindAvatar, verb-phrase name, muted line, CardAction pill (Needs you)",
    "Item variant=outline size=sm with the warning tint: question title, optional Tool: line",
    "ItemActions: option buttons (approval: Approve, Reject; permission: Allow once, Always allow, Reject) or one Answer in Inbox button",
  ],
  states: [
    "Approval: two options, Approve is the one filled button",
    "Permission: three options, Allow once is filled, the tool named on its own line",
    "Other kind: no buttons on the node; Answer in Inbox opens the Inbox",
    "Answering: buttons disable until the answer lands; conflicts close quietly",
  ],
  rules: {
    do: [
      "Answer approvals and permissions on the node so the canvas stays in view",
      "Use the warning tint (bg-warning/15, ring-warning/25) for every ask",
      "Send any other kind of question to the Inbox with one link",
    ],
    dont: [
      "A form or free text on the node",
      "More than one filled button",
      "Hard-coded status colors instead of the warning tokens",
    ],
  },
  parts: [
    "ui Card size=sm (Header, Title, Description, Action, Content)",
    "ui Item variant=outline size=sm (Content, Title, Description, Actions)",
    "ui Button (default for the primary option, outline for the rest)",
    "components/brand/KindAvatar, StatusPill (tone attention)",
  ],
  Component: NodeAskMockup,
}
