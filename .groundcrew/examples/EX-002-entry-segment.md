---
schema_version: 2
id: EX-002
title: Choose the entry segment
stage: 1
type: decision
objective: Know exactly who we are building for first.
context:
  - Problem statement approved in EX-000
depends_on: []
executor: groundcrew
scope:
  authorized:
    - Candidate segments, entry segment, qualification criteria, anti-persona
  out_of_scope:
    - Product scope and pricing
acceptance_criteria:
  - id: CA1
    criterion: One entry segment chosen, with the reason
    evidence:
      kind: decision
      ref: Decision D-03
  - id: CA2
    criterion: The choice is supported by signals from real people
    evidence:
      kind: external-source
      ref: Pre-sale sign-up answers
writes_to_memory:
  - Entry segment and qualification criteria
escalation:
  - The chosen segment matches the founder's own profile
status: approved
evaluation:
  state: approved
  date: 2026-10-29
  criteria:
    - id: CA1
      label: declared
    - id: CA2
      label: hypothesis
      note: Corroborated only once pre-sale data arrives
---

Decision missions need no instructions section: Groundcrew presents the options
and the creator decides.
