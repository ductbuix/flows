import type { YamlDiagnosticDto } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"

type Props = {
  errors: YamlDiagnosticDto[]
  onOpenAdvanced: () => void
}

/** Parse errors with Advanced off: Alert + button to open Advanced. */
export function YamlErrorAlert({ errors, onOpenAdvanced }: Props) {
  if (errors.length === 0) return null
  return (
    <div className="shrink-0 border-b p-3">
      <Alert variant="destructive" data-testid="yaml-errors">
        <AlertTitle>YAML errors</AlertTitle>
        <AlertDescription>
          <ul className="mb-2 list-inside list-disc text-sm">
            {errors.slice(0, 5).map((e, i) => (
              <li key={`${e.from}-${i}`}>{e.message}</li>
            ))}
          </ul>
        </AlertDescription>
        <AlertAction>
          <Button
            size="sm"
            variant="outline"
            data-testid="open-advanced-yaml"
            onClick={onOpenAdvanced}
          >
            Open Advanced
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}
