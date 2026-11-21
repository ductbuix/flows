import { LIBRARY_USAGE_WARN_RATIO, type LibraryUsage } from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ["KB", "MB", "GB", "TB"]
  let v = n
  let i = -1
  do {
    v /= 1024
    i += 1
  } while (v >= 1024 && i < units.length - 1)
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

type Props = {
  usage: LibraryUsage
}

/** Warn when the library is at or above 80% of library.maxBytes (BL-047). */
export function LibraryUsageAlert({ usage }: Props) {
  if (usage.maxBytes <= 0) return null
  if (usage.usedBytes / usage.maxBytes < LIBRARY_USAGE_WARN_RATIO) return null
  const pct = Math.min(
    100,
    Math.round((usage.usedBytes / usage.maxBytes) * 100)
  )
  return (
    <Alert data-testid="library-size-warning">
      <AlertTitle>Library nearly full</AlertTitle>
      <AlertDescription>
        Using {formatBytes(usage.usedBytes)} of {formatBytes(usage.maxBytes)} (
        {pct}%). Clear unused revisions or raise library.maxBytes in
        config.yaml. Pulls stop at the cap; pinned revisions are never deleted.
      </AlertDescription>
    </Alert>
  )
}
