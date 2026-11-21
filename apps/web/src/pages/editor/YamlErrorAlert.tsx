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
  onOpenYaml: () => void
}

/** Parse errors on the Graph pane: Alert + button to open the YAML tab. */
export function YamlErrorAlert({ errors, onOpenYaml }: Props) {
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
            data-testid="open-yaml-tab"
            onClick={onOpenYaml}
          >
            Open YAML
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}
