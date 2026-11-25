import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"

type Props = {
  conflict: boolean
  actionError: string | null
}

export function LibraryConflictAlert({ conflict, actionError }: Props) {
  return (
    <Alert variant="destructive" data-testid="library-conflict">
      <AlertTitle>{conflict ? "Conflict" : "Could not save"}</AlertTitle>
      <AlertDescription>
        {conflict
          ? "A provider changed on disk. Close Providers and try again."
          : actionError}
      </AlertDescription>
    </Alert>
  )
}
