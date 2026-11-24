import { build } from "esbuild"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outdir = join(root, "dist")
mkdirSync(outdir, { recursive: true })

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  sourcemap: true,
}

await Promise.all([
  build({
    ...shared,
    entryPoints: [join(root, "src/main.ts")],
    outfile: join(outdir, "main.cjs"),
    format: "cjs",
    // CJS: adapters-node/yaml use require("process"); Electron main loads CJS.
    external: ["electron", "ws"],
    banner: {
      js: 'var __import_meta_url = require("url").pathToFileURL(__filename).href;',
    },
    define: { "import.meta.url": "__import_meta_url" },
  }),
  build({
    ...shared,
    entryPoints: [join(root, "src/engine-host.ts")],
    outfile: join(outdir, "engine-host.cjs"),
    format: "cjs",
    // CJS: yaml and friends use require("process"); utilityProcess loads CJS fine.
  }),
  build({
    ...shared,
    entryPoints: [join(root, "src/preload.ts")],
    outfile: join(outdir, "preload.cjs"),
    format: "cjs",
    external: ["electron"],
  }),
])

console.log(
  "desktop: built dist/main.cjs, dist/engine-host.cjs, dist/preload.cjs"
)
