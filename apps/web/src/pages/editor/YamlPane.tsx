import { useMemo } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { yaml } from "@codemirror/lang-yaml"
import { linter, type Diagnostic } from "@codemirror/lint"
import type { YamlDiagnosticDto } from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"

type Props = {
  value: string
  errors: YamlDiagnosticDto[]
  onChange: (value: string) => void
}

export function YamlPane({ value, errors, onChange }: Props) {
  const extensions = useMemo(() => {
    const diagLinter = linter(() =>
      errors.map(
        (e): Diagnostic => ({
          from: e.from,
          to: Math.max(e.to, e.from + 1),
          severity: "error",
          message: e.message,
        })
      )
    )
    return [yaml(), diagLinter]
  }, [errors])

  return (
    <div className="flex h-full min-h-[160px] flex-col" data-testid="yaml-pane">
      {errors.length > 0 && (
        <Alert variant="destructive" className="mb-2" data-testid="yaml-errors">
          <AlertTitle>YAML errors</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc text-xs">
              {errors.slice(0, 5).map((e, i) => (
                <li key={`${e.from}-${i}`}>{e.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <CodeMirror
        value={value}
        height="100%"
        extensions={extensions}
        onChange={onChange}
        basicSetup={{ lineNumbers: true }}
        className="min-h-0 flex-1 overflow-hidden rounded-md border text-xs"
      />
    </div>
  )
}
