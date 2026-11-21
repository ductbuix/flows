export type {
  Connector,
  ConnectorChangeSet,
  ConnectorDiffInput,
  ConnectorPullInput,
  ConnectorPullResult,
  ConnectorPublishResult,
} from "./types.ts"
export {
  registerConnector,
  unregisterConnector,
  getConnector,
  listConnectors,
  clearConnectors,
} from "./registry.ts"
export { fakeConnector } from "./fake.ts"
export { githubConnector, createGithubConnector } from "./github/index.ts"
export {
  confluenceConnector,
  createConfluenceConnector,
  MCP_TRUST_REQUIRED,
} from "./confluence/index.ts"
export { registerBuiltinConnectors } from "./builtins.ts"
