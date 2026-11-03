---
schema_version: 2
id: EX-001
title: Add an about page
stage: 5
type: execution
objective: Visitors can read who is behind the product before they sign up.
context:
  - Brief approved in EX-000
depends_on: []
executor: hosted-agent
scope:
  authorized:
    - Create the /about route and its content
    - Add a link to /about on the home page
  out_of_scope:
    - Changing the home page layout
    - Adding new dependencies
acceptance_criteria:
  - id: CA1
    criterion: /about returns 200 and shows the heading "About us"
    evidence:
      kind: test
      ref: tests/e2e/about.spec.ts
  - id: CA2
    criterion: The home page links to /about
    evidence:
      kind: test
      ref: tests/e2e/about.spec.ts
  - id: CA3
    criterion: The text matches the copy the creator approved
    evidence:
      kind: creator-check
      ref: Comment on the pull request
writes_to_memory:
  - The product has an about page at /about
escalation:
  - The approved copy is missing
creator_prerequisites:
  - task: Approve the about page copy
    done: true
limits:
  max_cost_usd: 2
  max_turns: 30
  rules:
    - Never push to main
    - Do not add dependencies
status: ready
---

## Instructions

Create `src/app/about/page.tsx` with the heading "About us" and the approved
copy below. Add a link to `/about` on the home page. Cover CA1 and CA2 with a
Playwright test in `tests/e2e/about.spec.ts`.

Approved copy: "We build software that helps small teams launch faster."

## Report

Post the report in the pull request description, using the format in AGENTS.md.
