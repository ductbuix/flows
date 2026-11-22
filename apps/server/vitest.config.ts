import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Task-path tests run with the node path off until BL-098 deletes them;
    // node tests set FLOWS_NODES=1 (DES-037 Rollout, BL-096).
    env: { FLOWS_NODES: "0" },
  },
})
