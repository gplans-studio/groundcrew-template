#!/usr/bin/env bash
# Trades this run's GitHub Actions OIDC token for a short-lived Groundcrew run
# token (GC-042, D-87). The repository holds no Anthropic key: the agent calls
# Claude through the Groundcrew proxy, which checks the repository and the
# issue, measures the tokens and caps the spending.
#
# Needs: the job permission id-token: write, ISSUE (the mission's issue number)
# and GROUNDCREW_URL. Writes token and base_url to GITHUB_OUTPUT, both masked.
set -euo pipefail

: "${ISSUE:?ISSUE (the mission issue number) is required}"
: "${GROUNDCREW_URL:?GROUNDCREW_URL is required}"

if [ -z "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ] || [ -z "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" ]; then
  echo "::error::No OIDC token for this job: it needs the permission id-token: write."
  exit 1
fi

oidc=$(curl -sSf -H "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
  "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=groundcrew" | jq -r '.value')
echo "::add-mask::$oidc"

answer=$(curl -sS -w '\n%{http_code}' -X POST "${GROUNDCREW_URL%/}/api/runs/token" \
  -H "Authorization: Bearer $oidc" \
  -H "Content-Type: application/json" \
  -d "{\"issue_number\": $ISSUE}")
code=$(tail -n 1 <<<"$answer")
body=$(sed '$d' <<<"$answer")

if [ "$code" != "200" ]; then
  reason=$(jq -r '.error // empty' <<<"$body" 2>/dev/null || true)
  echo "::error::Groundcrew refused the run token (HTTP $code): ${reason:-no reason given}"
  {
    echo "reason<<GROUNDCREW_EOF"
    echo "HTTP $code: ${reason:-no reason given}"
    echo "GROUNDCREW_EOF"
  } >> "$GITHUB_OUTPUT"
  exit 1
fi

token=$(jq -r '.token' <<<"$body")
base_url=$(jq -r '.base_url' <<<"$body")
echo "::add-mask::$token"
{
  echo "token=$token"
  echo "base_url=$base_url"
} >> "$GITHUB_OUTPUT"
echo "Run token received from ${GROUNDCREW_URL%/}; Claude calls go through $base_url."
