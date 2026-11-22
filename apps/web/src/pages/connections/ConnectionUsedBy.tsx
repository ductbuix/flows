import { Link } from "react-router"
import { PageSection } from "@/components/page"
import { runPath, workflowPath } from "@/lib/paths"
import { mono } from "@/components/data/mono"

type Props = {
  workflows: string[]
  runs: string[]
}

export function ConnectionUsedBy({ workflows, runs }: Props) {
  return (
    <PageSection title="Used by">
      <div
        className="flex flex-col gap-2 text-sm"
        data-testid="connection-used-by"
      >
        <div>
          <span className="text-muted-foreground">Workflows: </span>
          {workflows.length === 0
            ? "—"
            : workflows.map((id, i) => (
                <span key={id}>
                  {i > 0 ? ", " : null}
                  <Link
                    to={workflowPath(id)}
                    className={`${mono} hover:underline`}
                  >
                    {id}
                  </Link>
                </span>
              ))}
        </div>
        <div>
          <span className="text-muted-foreground">Runs: </span>
          {runs.length === 0
            ? "—"
            : runs.map((id, i) => (
                <span key={id}>
                  {i > 0 ? ", " : null}
                  <Link to={runPath(id)} className={`${mono} hover:underline`}>
                    {id}
                  </Link>
                </span>
              ))}
        </div>
      </div>
    </PageSection>
  )
}
