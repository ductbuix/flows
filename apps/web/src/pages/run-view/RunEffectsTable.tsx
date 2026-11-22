import type { RunDetail } from "@workspace/shared"
import { Zap } from "lucide-react"
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
import { ImpactBadge } from "@/components/ImpactBadge"
import { PageSection } from "@/components/page"

type Props = {
  run: RunDetail
}

/** Effects ledger: what, connection, impact, result, undo (DES-025 J11). */
export function RunEffectsTable({ run }: Props) {
  const effects = run.effects ?? []
  return (
    <PageSection title="Effects">
      {effects.length === 0 ? (
        <Empty className="border" data-testid="run-effects-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Zap />
            </EmptyMedia>
            <EmptyTitle>No effects yet</EmptyTitle>
            <EmptyDescription>
              Pulls, local work copies and publishes show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table data-testid="run-effects">
          <TableHeader>
            <TableRow>
              <TableHead>What</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Impact</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Undo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {effects.map((effect, index) => (
              <TableRow
                key={`${effect.connection}-${effect.impact}-${index}`}
                data-testid={`run-effect-${index}`}
              >
                <TableCell>{effect.what}</TableCell>
                <TableCell className="font-mono">{effect.connection}</TableCell>
                <TableCell>
                  <ImpactBadge impact={effect.impact} />
                </TableCell>
                <TableCell className="max-w-48 truncate font-mono text-muted-foreground">
                  {effect.result ?? "—"}
                </TableCell>
                <TableCell className="max-w-64 text-muted-foreground">
                  {effect.undoNote ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageSection>
  )
}
