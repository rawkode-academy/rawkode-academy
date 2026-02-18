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
4. For each unique issue key:
   - find the issue in Linear
   - determine the team's completed/done state
   - if the issue is not completed, transition it to the completed/done state
   - add a Linear comment with the merged PR URL and merge commit SHA
5. If no issue keys are found, report `no linked Linear issues` and exit successfully.
6. Return a compact summary listing updated issues, already-complete issues, and missing/invalid keys.

## Guardrails

- Do not create new Linear issues.
- Do not guess issue keys.
- If a transition fails for one issue, continue processing the remaining issues and report the failure.
