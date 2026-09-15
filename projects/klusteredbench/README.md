# KlusteredBench

Repeatable evaluation of LLM agents against deliberately broken Kubernetes
clusters. Every trial is a fresh cluster, a scripted break, and one agent
with a root shell on the control plane. The harness measures whether the
cluster came back, how fast, and what it cost.

```
scenario x agent x trial  ->  fresh cluster -> setup (green) -> break (red)
                              -> agent works while verify polls
                              -> final verify + invariants -> destroy
```

## What is measured

| Metric | Source | Notes |
|---|---|---|
| `success` | harness | verify passes after the agent stopped, and invariants hold |
| `timeToGreenMs` | harness poller | first passing verify, independent of what the agent claims |
| `greenAtEnd` vs `timeToGreenMs` | harness | agents that fix then re-break show up as green-then-failed |
| `agentWallMs` | harness | start to stop, including the harness timeout |
| `usage` | agent | input, output, cache-write and cache-read tokens |
| `estimatedCostUsd` | pricing table | `null` for unpriced models, never guessed |
| `reportedCostUsd` | agent | Claude Code reports its own bill; the report prefers it |
| `turns`, `toolCalls` | agent | model round-trips and shell executions |
| `exitReason` | agent | `completed`, `timeout`, `stopped_on_green`, `max_turns`, `refusal`, `error` |

The report aggregates per scenario x agent and per agent: success rate,
median time-to-green over successes, mean tokens, total cost and
**cost per successful fix** (total spend divided by successes, so failed
attempts are not free).

## Quick start

Prerequisites on the host: `bun`, `docker`, `kind`, and `ANTHROPIC_API_KEY`
in the environment.

```sh
cd projects/klusteredbench
bun install
bun run bench scenarios list
bun run bench scenarios validate            # proves every scenario: green -> red -> solve -> green
bun run bench run --scenario service-selector-typo --agent opus-5 --trials 1
bun run bench report results/<runId>
```

`bench.yaml` is the matrix. Anything in it can be narrowed from the CLI
(`--scenario`, `--agent`, `--trials`, `--parallel`, `--stop-on-green`).

## How a trial is isolated

The cluster provider (`kind` by default) exposes exactly one primitive:
run a bash script as root on the control-plane node. Setup, break, verify,
solve and every command the agent issues go through it. The agent is
therefore confined to the node container, as a Klustered contestant is,
and gets the same surface: the admin kubeconfig, `/etc/kubernetes/manifests`,
kubelet, containerd. Node-level breaks (static pod manifests, controller
flags) are in scope.

The `fake` provider runs scripts in a scratch directory on the host so the
runner, timeouts and reporting can be tested without Docker. It is not a
cluster and only the test fixtures use it.

## Agents

| type | what it measures | notes |
|---|---|---|
| `builtin` | a model | One frozen harness: the shared system prompt in `src/agents/prompt.ts` and a single `shell` tool. Two `builtin` agents differ only by model and effort. Uses the Anthropic SDK directly. Refusal fallbacks are deliberately off: a benchmark must not silently substitute a model, so a refusal is recorded as `exitReason: refusal`. |
| `claude-code` | the product | Installs the Claude Code CLI on the node and runs it with `-p --output-format stream-json`. Tokens and cost come from the CLI's own `result` event. The shared brief is appended to Claude Code's own system prompt, not substituted for it. |
| `command` | anything else | Runs an arbitrary command on the node with the prompt in `$KB_PROMPT_FILE`. Usage is whatever the command writes to `$KB_USAGE_FILE`. Use it for Codex, Gemini CLI, OpenCode, or a homegrown loop. |
| `fake` | the harness | Scripted steps for tests. |

## Scenarios

A scenario is a directory under `scenarios/`:

```
scenarios/<id>/
  scenario.yaml    id, title, difficulty, tags, timeout, prompt, solution (never shown to the agent)
  break.sh         required: turn the green baseline red
  verify.sh        required: exit 0 only when the goal state holds
  solve.sh         reference fix; `scenarios validate` uses it to prove the scenario is solvable
  setup.sh         optional: defaults to _lib/setup.sh (the Klustered quotes app, v1, on NodePort 30000)
  invariants.sh    optional: post-conditions that a "fix" must not violate, e.g. the database Deployment still exists
```

`_lib/prelude.sh` is prepended to every script. It provides `kb_app_ok [v2]`
(the app answers with a seeded quote and no database error), `kb_wait`,
`kb_node_ip` and `kb_http_get`, which speaks HTTP over bash's `/dev/tcp`
because kind node images ship neither curl nor wget.

Shipped scenarios, ported from the Klustered labs on labs.iximiuz.com:

| id | difficulty | break |
|---|---|---|
| `service-selector-typo` | easy | Service selector `app: klustred` |
| `scheduling-gate` | easy | database pod template carries an unremovable `schedulingGate` |
| `dns-policy-default` | easy | app pod has `dnsPolicy: Default`, cannot resolve `postgres` |
| `readiness-probe-wrong-port` | easy | readiness probe on 8080, app listens on 666 |
| `init-container-wrong-host` | easy | init container waits on `postgresql`, Service is `postgres` |
| `infeasible-cpu-request` | easy | container requests 64 CPUs |
| `image-tag-typo` | easy | `klustered:v1.0` does not exist |
| `validating-admission-policy-lockout` | medium | VAP denies creation of any non-`kube-` pod in `default` |
| `replicaset-controller-disabled` | hard | kube-controller-manager runs with `-replicaset-controller`; verify also proves a fresh ReplicaSet gets a pod |
| `level-one` | medium | gate + selector + dnsPolicy, then ship `v2` |
| `level-four` | medium | 64 CPU + init hostname + probe port in one template, then ship `v2` |

### Rules for a valid scenario

`scenarios validate` enforces them on a real cluster:

1. `setup` passes and `verify` is green before the break.
2. `break` passes and `verify` is red afterwards. A break that does not bite fails validation, and `run` refuses to start the agent in that case.
3. `solve` passes and `verify` is green afterwards.
4. `invariants` hold after `solve`.

Prompts state the goal, never the cause. The test suite checks a few
obvious leaks (`selector`, `dnsPolicy`) but the reviewer is the real gate.

## Results layout

```
results/<runId>/
  summary.json                 every TrialResult plus the config used
  summary.md                   the aggregated tables
  <scenario>/<agent>/trial-N/
    result.json                one TrialResult (schemaVersion 1)
    transcript.jsonl           assistant text, thinking summaries, tool calls, tool results, per-turn usage, verify samples
    setup.log break.log verify.log solve.log invariants.log
```

`report DIR` re-aggregates any tree of `result.json` files, so runs can be
combined or re-rendered later.

## Reproducibility

- Each trial is a new `kind` cluster. Pin `provider.nodeImage` for a
  publishable run; the resolved server version is recorded in every result
  regardless.
- The `builtin` system prompt and tool definition are frozen. Changing them
  invalidates comparisons with earlier runs.
- The pricing table in `src/pricing.ts` is a snapshot. Override it per run
  under `pricing:` in `bench.yaml` when list prices move.
- `stopOnGreen: false` (the default) lets the agent run to its own stopping
  point so post-fix damage counts. It costs more tokens.
- Verify runs on the same node the agent uses. That is a small perturbation
  (a few kubectl calls every `pollInterval`) which every agent sees equally.

## Known limits

- Not run end to end against kind in the environment this was written in
  (no Docker daemon there). The runner, validator, poller, timeout and
  reporting paths are covered by tests on the `fake` provider; the kind
  provider and the scenario scripts are reviewed but unproven until
  `scenarios validate` has been run on a real host.
- Claude Code as root: the CLI refuses `--dangerously-skip-permissions`
  as root unless `IS_SANDBOX=1`, which the adapter sets. If a future CLI
  version changes that check, run the node with a non-root user.
- Level Two's in-place pod resize break and Level Three's
  MutatingAdmissionPolicy break need Kubernetes 1.33+ / 1.36+ feature
  state that the default kind image may not have. They are not ported yet.
- One node. Multi-node breaks (kubelet on a worker, CNI) need a
  multi-node kind config on the provider.

## Development

```sh
bun run check      # tsc
bun run lint       # biome
bun run test       # vitest, no Docker needed
```

This package is deliberately outside the Bun workspace (see the root
`package.json`) so it carries its own lockfile and cannot break the
monorepo's frozen install.
