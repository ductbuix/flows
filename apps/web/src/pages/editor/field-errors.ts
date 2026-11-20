import type { YamlDiagnosticDto } from "@workspace/shared"

/** Errors for one task field, keyed by the last path segment (DES-018). */
export function taskFieldErrors(
  errors: YamlDiagnosticDto[],
  taskIndex: number,
  field: string
): Array<{ message: string }> {
  return errors
    .filter(
      (e) =>
        e.path[0] === "tasks" && e.path[1] === taskIndex && e.path[2] === field
    )
    .map((e) => ({ message: e.message }))
}
