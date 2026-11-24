/**
 * Skills are plain folders with a SKILL.md, read by each CLI from its own place.
 * Nothing is converted: the app only discovers them, and copies a skill out of a
 * source repo on install (a later source update never touches the installed copy).
 */
export type Scope = "workspace" | "home"
export type SkillDir = ".agents" | ".claude" | ".cursor"

export type Skill = {
  slug: string
  name: string
  description: string
  scope: Scope
  /** Folders that hold a copy. Installed skills get two: .agents and .claude. */
  dirs: SkillDir[]
  /** Set when installed from a source repo: the Library item and the version copied. */
  from?: { sourceId: string; version: number }
  /** The skill breaks the spec; it is listed but not offered. */
  problem?: string
  body: string
}

export type SourceSkill = {
  slug: string
  name: string
  description: string
  body: string
}

const md = (name: string, description: string, rules: string[]) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\n${rules.map((r) => `- ${r}`).join("\n")}\n`

export const sk = (
  slug: string,
  description: string,
  rules: string[]
): SourceSkill => ({
  slug,
  name: slug,
  description,
  body: md(slug, description, rules),
})

/** What a source repo offers under skills/. New sources get the generic pair. */
export const SOURCE_SKILLS: Record<string, SourceSkill[]> = {
  "repo-team-skills": [
    sk(
      "write-tests",
      "Write focused unit tests for a changed file. Use when asked to add or fix tests.",
      [
        "Read the diff first",
        "One behaviour per test",
        "No mocks for pure functions",
      ]
    ),
    sk(
      "review-pr",
      "Review a pull request for correctness and risk. Use when asked to review a PR.",
      [
        "Start with the riskiest file",
        "Quote the line you mean",
        "Separate must-fix from nits",
      ]
    ),
    sk("release-notes", "Turn a changelog into customer-facing notes.", [
      "Group by user impact",
      "Skip internal refactors",
    ]),
  ],
}
export const GENERIC_SKILLS: SourceSkill[] = [
  sk("review", "Review changes in this repository.", [
    "Follow the repo's conventions",
  ]),
  sk("explain", "Explain how a part of this repository works.", [
    "Cite files and lines",
  ]),
]

export const INITIAL_SKILLS: Skill[] = [
  {
    ...sk("write-tests", SOURCE_SKILLS["repo-team-skills"]![0]!.description, [
      "Read the diff first",
      "One behaviour per test",
    ]),
    scope: "workspace",
    dirs: [".agents", ".claude"],
    from: { sourceId: "repo-team-skills", version: 1 },
  },
  {
    ...sk("commit-style", "Write commit messages in this repo's style.", [
      "Imperative mood",
      "Reference the ticket",
    ]),
    scope: "workspace",
    dirs: [".cursor"],
  },
  {
    ...sk("summarize-pr", "Summarize a pull request in five lines.", [
      "Lead with the user impact",
    ]),
    scope: "home",
    dirs: [".agents"],
  },
  {
    ...sk("brainstorm", "Explore options before building.", [
      "Ask one question at a time",
    ]),
    scope: "home",
    dirs: [".agents", ".claude"],
  },
  {
    ...sk("sql-helper", "Draft and explain SQL.", ["Show the plan"]),
    scope: "home",
    dirs: [".agents"],
  },
  {
    slug: "broken-skill",
    name: "broken-skill",
    description: "",
    scope: "workspace",
    dirs: [".claude"],
    problem: "SKILL.md has no description",
    body: "---\nname: broken-skill\n---\n\nTODO\n",
  },
]
