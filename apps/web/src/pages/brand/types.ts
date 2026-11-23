import type { ComponentType } from "react"

export type MockupGroup = "Foundations" | "Work items" | "Workflows"

/**
 * One mockup on /brand. Agents read `rules` before building the real thing;
 * keep it in sync with DESIGN.md.
 */
export type Mockup = {
  id: string
  title: string
  group: MockupGroup
  summary: string
  /** Where the pattern is used in the app. */
  usedIn: string[]
  /** Named parts, top to bottom. */
  anatomy: string[]
  /** States the pattern must show. */
  states: string[]
  rules: { do: string[]; dont: string[] }
  /** Components to build it from. */
  parts: string[]
  Component: ComponentType
}
