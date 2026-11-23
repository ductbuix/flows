import { useState } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { ArrowLeft, Workflow } from "lucide-react"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import type { Mockup } from "../types"

const EXAMPLES = [
  "Check a release before it ships",
  "Triage new bugs every morning",
]
const CONNECTIONS = ["GitHub", "Rally", "Confluence"]

/** Create a workflow from a plain sentence. */
export function CreateFormMockup() {
  const [goal, setGoal] = useState(
    "Before each release, compare open PRs with the spec, check tests and draft the notes."
  )
  const [uses, setUses] = useState<string[]>(["GitHub"])
  return (
    <Card className="w-full max-w-xl" data-testid="mockup-create-form">
      <CardHeader className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back">
          <ArrowLeft />
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Workflows</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>New workflow</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="brand-name">Name</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <Workflow />
              </InputGroupAddon>
              <InputGroupInput id="brand-name" defaultValue="Release check" />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="brand-goal">What should it do?</FieldLabel>
            <Textarea
              id="brand-goal"
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <FieldDescription>
              One or two sentences. Flows drafts the nodes from this.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Start from an example</FieldLabel>
            <Suggestions>
              {EXAMPLES.map((ex) => (
                <Suggestion key={ex} suggestion={ex} onClick={setGoal} />
              ))}
            </Suggestions>
          </Field>
          <Field>
            <FieldLabel>It can use</FieldLabel>
            <ToggleGroup
              multiple
              variant="outline"
              value={uses}
              onValueChange={setUses}
            >
              {CONNECTIONS.map((c) => (
                <ToggleGroupItem key={c} value={c}>
                  {c}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost">Cancel</Button>
        <Button>Create workflow</Button>
      </CardFooter>
    </Card>
  )
}

export const createFormMockup: Mockup = {
  id: "create-form",
  title: "Create form",
  group: "Foundations",
  summary:
    "Make something new from a plain sentence: name, goal, examples, what it can use.",
  usedIn: ["New workflow", "New work item", "Start run inputs"],
  anatomy: [
    "CardHeader: back Button + ui Breadcrumb (Workflows › New workflow)",
    "Name: InputGroup with an icon InputGroupAddon",
    "Question-style label for the goal (What should it do?) and a Textarea",
    "Examples: AI Elements Suggestions; clicking one fills the goal",
    "It can use: ToggleGroup multiple, variant=outline",
    "CardFooter: Cancel (ghost) and one primary action named for the result",
  ],
  states: [
    "Empty: placeholders show a real example, not 'Enter text'",
    "Invalid: FieldError under the field, primary stays enabled",
    "Saving: primary shows a Spinner and keeps its label",
  ],
  rules: {
    do: [
      "Ask questions in labels: What should it do?",
      "Name the button for what it makes: Create workflow",
      "Build from Card, Breadcrumb, Field, InputGroup, Textarea, ToggleGroup, Suggestion",
    ],
    dont: [
      "YAML, ids or file paths in a create form",
      "More than five fields; push advanced settings to the detail panel",
      "Submit or OK as button text",
    ],
  },
  parts: [
    "ui Field, FieldGroup, FieldLabel, FieldDescription",
    "ui Card, Breadcrumb, InputGroup, Textarea, ToggleGroup, Button",
    "ai-elements Suggestions / Suggestion",
  ],
  Component: CreateFormMockup,
}
