declare module "*eslint-dependency-guards.mjs" {
  export const noCycleBlock: {
    files: string[]
    plugins: Record<string, unknown>
    settings: Record<string, unknown>
    rules: Record<string, unknown>
  }
  export const contractsRestrictedImports: Record<string, unknown>
  export const coreRestrictedImports: Record<string, unknown>
  export const adaptersRestrictedImports: Record<string, unknown>
  export const webRestrictedImports: Record<string, unknown>
}
