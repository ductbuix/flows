import type { WorkflowInputDecl } from "@workspace/shared"
import { SlidersHorizontal } from "lucide-react"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PageSection } from "@/components/page"
import { mono } from "@/components/data/mono"

type Props = { inputs: WorkflowInputDecl[] }

export function OverviewInputsSection({ inputs }: Props) {
  if (inputs.length === 0) {
    return (
      <PageSection title="Inputs">
        <Empty
          className="ring-1 ring-foreground/10"
          data-testid="overview-inputs-empty"
        >
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SlidersHorizontal />
            </EmptyMedia>
            <EmptyTitle>No inputs</EmptyTitle>
            <EmptyDescription>
              This workflow has no declared start-run inputs.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PageSection>
    )
  }
  return (
    <PageSection title="Inputs">
      <Table data-testid="overview-inputs">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Required</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inputs.map((input) => (
            <TableRow key={input.name}>
              <TableCell className={mono}>{input.name}</TableCell>
              <TableCell>{input.type}</TableCell>
              <TableCell>{input.required ? "Yes" : "No"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </PageSection>
  )
}
