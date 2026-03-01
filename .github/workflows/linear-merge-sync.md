---
on:
  pull_request:
    types: [closed]
    branches: [main]

strict: false

permissions:
  contents: read
  pull-requests: read

network:
  allowed:
    - defaults
    - mcp.linear.app

tools:
  github:
    toolsets: [pull_requests, repos]

mcp-servers:
  linear:
    url: "https://mcp.linear.app/mcp"
    headers:
      Authorization: "Bearer ${{ secrets.LINEAR_API_TOKEN }}"
    allowed: ["*"]
---

# Sync Linear issues for merged PRs

Goal: when a pull request is merged into `main`, update all linked Linear issues.

## Steps

1. Inspect the pull request from the event context.
2. If the pull request is not merged, stop and report `skipped (not merged)`.
3. Collect Linear issue keys from:
   - pull request title
   - pull request body
   - head branch name
4. If no explicit issue keys are found, run fallback discovery in Linear:
   - search existing issues using normalized pull request title and head branch tokens
   - include the pull request URL and number in matching context when available
   - prefer issues in active states over completed/canceled states
   - only accept a fallback match when there is exactly one high-confidence candidate
   - if matching is ambiguous, report `no confident Linear match` and exit successfully
5. Build the final issue list from:
   - explicit keys (if any)
   - fallback match (if confidently found)
6. For each issue in the final list:
   - find the issue in Linear
   - determine the team's completed/done state
   - if the issue is not completed, transition it to the completed/done state
   - add a Linear comment with the merged PR URL and merge commit SHA
7. If the final issue list is empty, report `no linked Linear issues` and exit successfully.
8. Return a compact summary listing updated issues, already-complete issues, missing/invalid keys, and fallback-match outcomes.

## Guardrails

- Do not create new Linear issues.
- Do not guess issue keys.
- Never update an issue from fallback discovery when matching is ambiguous.
- If a transition fails for one issue, continue processing the remaining issues and report the failure.
