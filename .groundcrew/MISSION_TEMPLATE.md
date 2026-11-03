---
# Copy this file to .groundcrew/missions/<ID>-<short-name>.md and fill it in.
# The front matter is the contract (schema: .groundcrew/mission.schema.json).
# Check it with: npm run missions:check
schema_version: 2
id: XX-000                 # Mission id, e.g. GC-012. The file name must start with it.
title: Short imperative title
stage: 5                   # 1 Discovery · 2 Product/MVP · 3 Planning · 4 Foundation · 5 Build · 6 Quality · 7 Launch · 8 Evolution
type: execution            # execution (produces a PR) or decision (produces product definitions)
objective: What the creator sees, in business language.
context:                   # Earlier decisions and documents this mission must respect
  - D-04 evidence rule
depends_on: []             # Missions that must be approved first
executor: hosted-agent     # execution: hosted-agent | local-agent | creator · decision: groundcrew | creator
scope:
  authorized:
    - What the mission may create or change
  out_of_scope:
    - What it must not touch
acceptance_criteria:       # Each criterion names its evidence (rule D-04)
  - id: CA1
    criterion: What the result must show
    evidence:
      kind: test           # execution: ci-job | test | creator-check | external-source · decision: decision | external-source | creator-check
      ref: path/to/the.test.ts
writes_to_memory:          # Facts this mission creates or changes in the Product Memory
  - Fact recorded after approval
escalation:                # When to stop and ask the creator
  - An account, key, token or external setting is needed
creator_prerequisites:     # Required for execution missions; may be empty
  - task: Human step needed before the mission starts
    done: false
limits:                    # Required for execution missions
  max_cost_usd: 10
  max_turns: 50
  rules:
    - Never push to main
status: draft              # draft | ready | running | in-review | approved | correction-needed | needs-verification | needs-decision
---

## Instructions

Instructions for the agent, in the language the agent works best in. Say what
to build, where, and how to prove it. The rules in AGENTS.md always apply.

## Report

Post the report in the pull request description, using the format in AGENTS.md.
