import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const nodeAssetYaml = (id: string) => `id: ${id}
goal: e2e asset node
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: lib
    kind: asset
    resources: []
    access: read
  - id: read
    kind: command
    run: 'cat "$RESOURCE_ASSET_DEMO/repo/alpha/data.txt"'
edges:
  - { from: start, to: read }
  - { from: lib, to: read }
`

const nodePublishYaml = (
  id: string,
  access = "propose",
  target = "publish"
) => `id: ${id}
goal: e2e output publish
nodes:
  - id: start
    kind: trigger
    type: manual
  - id: lib
    kind: asset
    access: ${access}
    resources:
      - { connection: pub-demo, entity: item, id: alpha }
  - id: edit
    kind: command
    run: 'echo changed > "$RESOURCE_PUB_DEMO/item/alpha/data.txt"'
  - id: ship
    kind: output
    target: ${target}${target === "publish" ? "\n    connection: pub-demo" : ""}
edges:
  - { from: start, to: edit }
  - { from: lib, to: edit }
  - { from: edit, to: ship }
`

/** Asset and output publish workflows (BL-082, BL-084). */
export function seedAssetWorkflows(home: string): void {
  // Asset workflows for node-asset.spec.ts (BL-082); each test owns one.
  for (const id of ["node-asset-light", "node-asset-dark"]) {
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodeAssetYaml(id))
  }
  // Output publish workflows for node-output-publish.spec.ts (BL-084).
  for (const id of [
    "node-publish-light",
    "node-publish-dark",
    "node-publish-reject",
    "node-publish-ledger",
  ]) {
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), nodePublishYaml(id))
  }
  const publishSheet = join(home, "workflows", "node-publish-sheet")
  mkdirSync(publishSheet, { recursive: true })
  writeFileSync(
    join(publishSheet, "workflow.yaml"),
    nodePublishYaml("node-publish-sheet", "read", "folder")
  )
}
