export const nodeRunYaml = (
  id: string,
  run: string,
  trigger = true
) => `id: ${id}
goal: e2e node run
nodes:
${trigger ? "  - id: start\n    kind: trigger\n    type: manual\n" : ""}  - id: build
    kind: command
    run: ${JSON.stringify(run)}
  - id: done
    kind: output
    target: folder
edges:
${trigger ? "  - { from: start, to: build }\n" : ""}  - { from: build, to: done }
`
