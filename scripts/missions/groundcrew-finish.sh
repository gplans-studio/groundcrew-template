#!/usr/bin/env bash
# Tells Groundcrew that a mission run ended (GC-043, D-91), with the same OIDC
# proof as the run token. Groundcrew records the outcome, the pull request and
# the agent's own cost and turns, and expires the run token.
#
# Needs: the job permission id-token: write, GROUNDCREW_URL, AGENT_OUTCOME (the
# agent step's outcome), and optionally EXECUTION_FILE (the agent's log) and
# PR_URL. Never fails the job: the run itself already happened.
set -uo pipefail

: "${GROUNDCREW_URL:?GROUNDCREW_URL is required}"

subtype="" cost="" turns="" last=""
if [ -n "${EXECUTION_FILE:-}" ] && [ -f "$EXECUTION_FILE" ]; then
  result=$(jq -c '[.[] | select(.type == "result")] | last // {}' "$EXECUTION_FILE" 2>/dev/null || echo '{}')
  subtype=$(jq -r '.subtype // empty' <<<"$result")
  cost=$(jq -r '.total_cost_usd // empty' <<<"$result")
  turns=$(jq -r '.num_turns // empty' <<<"$result")
  last=$(jq -r '.result // empty' <<<"$result")
fi

pr_number=""
if [ -n "${PR_URL:-}" ]; then pr_number="${PR_URL##*/}"; fi

if [ -n "${PR_URL:-}" ]; then
  outcome="success"
elif grep -qi "spending cap" <<<"$last" || [ "$subtype" = "error_max_budget_usd" ]; then
  outcome="stopped_cap"
elif [ "${AGENT_OUTCOME:-}" = "failure" ] || [ -z "$subtype" ]; then
  outcome="failed"
else
  outcome="no_pull_request"
fi

body=$(jq -n --arg outcome "$outcome" --arg url "${PR_URL:-}" --arg n "$pr_number" \
  --arg cost "$cost" --arg turns "$turns" \
  '{outcome: $outcome}
   + (if $url != "" then {pull_request_url: $url} else {} end)
   + (if $n != "" then {pull_request_number: ($n | tonumber)} else {} end)
   + (if $cost != "" then {agent_cost_usd: ($cost | tonumber)} else {} end)
   + (if $turns != "" then {turns: ($turns | tonumber)} else {} end)')

oidc=$(curl -sS -H "Authorization: Bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" \
  "${ACTIONS_ID_TOKEN_REQUEST_URL:-}&audience=groundcrew" | jq -r '.value // empty')
if [ -z "$oidc" ]; then
  echo "::warning::No OIDC token: Groundcrew was not told that the run ended."
  exit 0
fi
echo "::add-mask::$oidc"

code=$(curl -sS -o "${RUNNER_TEMP:-/tmp}/finish.json" -w '%{http_code}' -X POST "${GROUNDCREW_URL%/}/api/runs/finish" \
  -H "Authorization: Bearer $oidc" -H "Content-Type: application/json" -d "$body")
if [ "$code" = "200" ]; then
  echo "Groundcrew recorded the run as $outcome."
else
  echo "::warning::Groundcrew did not record the end of the run (HTTP $code): $(jq -r '.error // empty' "${RUNNER_TEMP:-/tmp}/finish.json" 2>/dev/null)"
fi
exit 0
