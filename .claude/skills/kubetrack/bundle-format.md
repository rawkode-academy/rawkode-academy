# KubeTrack bundle format

One Markdown file per release, read by
`projects/rawkode.academy/platform/kubetrack/scripts/load-release.ts`. The
file has three parts, in this order: front matter, then the intro and the
cards, then the quiz.

The example values below show the shape. Check every value against upstream
before you use it.

## Front matter

```md
---
id: "1.37"
title: Kubernetes v1.37
codename: Garhwal
releasedAt: 2026-08-26
publishedAt: 2026-11-16
summary: Every Kubernetes v1.37 "Garhwal" enhancement explained on one card each, then a 20-question quiz to check you are release ready.
releaseBlogUrl: https://kubernetes.io/blog/2026/08/26/kubernetes-v1-37-release/
changelogUrl: https://github.com/kubernetes/kubernetes/blob/master/CHANGELOG/CHANGELOG-1.37.md
upstreamCounts: { stable: 16, beta: 23, alpha: 27, deprecated: 1 }
---
```

| Key | Column | Rule |
|---|---|---|
| `id` | `releases.id` | `"major.minor"`, quoted; `major` and `minor` are derived from it |
| `title` | `title` | `Kubernetes v<id>` |
| `codename` | `codename` | optional |
| `releasedAt` | `released_at` | `YYYY-MM-DD`; stored in seconds |
| `publishedAt` | `published_at` | `YYYY-MM-DD` or an ISO instant; the visibility gate, in the future while in review |
| `summary` | `summary` | at most 160 characters |
| `releaseBlogUrl`, `changelogUrl` | same | optional URLs |
| `upstreamCounts` | `upstream_counts` | the blog's numbers; all four keys, or leave the key out |

## Intro

The Markdown between the front matter and the first `## KEP-` heading becomes
`releases.body`. Don't use headings above level 3 in it.

## A card

~~~md
## KEP-1710 · stable · storage · SELinuxMount
title: Speed up recursive SELinux label change
gate-default: on
previous: beta@1.35
theme: storage
docs: https://kubernetes.io/docs/tasks/configure-pod-container/security-context/
What: Volumes on SELinux nodes are mounted with the right label straight away instead of being relabelled file by file.

### Why it matters
…

### How to use it
…

### Example
```yaml
apiVersion: v1
kind: Pod
…
```
~~~

| Line | Column | Rule |
|---|---|---|
| heading `KEP-<n>` | `kep`, `slug` = `kep-<n>`, `id` = `<release>/kep-<n>` | unique within the release |
| heading stage | `stage` | `alpha`, `beta`, `stable` or `deprecated` |
| heading SIG | `sig` | lowercase, no `sig-` prefix |
| heading gate | `feature_gate` | optional last segment, exact upstream case |
| `title:` | `title` | required, sentence case |
| `gate-default:` | `enabled_by_default` | `on` or `off`; leave it out without a gate |
| `previous:` | `previous_stage`, `previous_stage_version` | `<stage>@<major.minor>`; optional |
| `theme:` | `theme` | optional, lowercase |
| `docs:` | `docs_url` | optional URL |
| `What:` | `summary` | one sentence, at most 160 characters |
| `### Why it matters`, `### How to use it` | `body` | both required, in this order |
| `### Example` | `example` | optional; exactly one fenced block, `yaml` or `shell` |

Metadata lines come straight after the heading, one per line, before `What:`.
The card's position in the file becomes `sort_order`.

## The quiz

The quiz starts at a level-2 `## Quiz` heading, after the last card.

```md
## Quiz

### q01 · kep-1710 · single
With `SELinuxMount` on, how does the kubelet apply the Pod's SELinux label to a supported volume?
- [ ] a It relabels every file on the volume before the Pod starts
- [x] b It mounts the volume with `-o context=<label>`
- [ ] c It skips labelling and relies on the container runtime
- [ ] d It labels files lazily on first access
> Mounting with the `context` option labels the whole volume in one step, so start-up time no longer grows with the number of files. Recursive relabelling is the old behaviour, which `seLinuxChangePolicy: Recursive` keeps for Pods that need it.

### q02 · kep-1710 · true_false
Two Pods with different SELinux labels can always share one volume on the same node once `SELinuxMount` is on.
- [ ] a True
- [x] b False
> A volume mounted with one `context` label can't serve a Pod with another label on the same node, so the second Pod can fail to start. Set `spec.securityContext.seLinuxChangePolicy: Recursive` on Pods that must share a volume like this.

### q03 · kep-1710 · multiple
Which two settings decide whether a volume is mounted with a context label? Choose two.
- [x] a `seLinuxMount: true` on the CSIDriver
- [ ] b `readOnly: true` on the volume mount
- [x] c The Pod's `seLinuxChangePolicy`
- [ ] d `fsGroupChangePolicy: OnRootMismatch`
> The driver must declare support with `seLinuxMount: true`, and the Pod must not opt out with `seLinuxChangePolicy: Recursive`. `fsGroupChangePolicy` controls ownership changes, not SELinux labels.
```

| Part | Column | Rule |
|---|---|---|
| `### q<nn>` | `id` = `<release>/q<nn>` | two digits, numbered in order |
| `kep-<n>` | `feature_id` | must match a card in this bundle |
| kind | `kind` | `single`, `multiple` or `true_false` |
| text up to the first choice | `prompt` | Markdown |
| `- [ ]` / `- [x]` lines | `choices`, `answer_ids` | the id is the letter after the box (`a` to `d`); `true_false` uses exactly `a True` and `b False` |
| `>` block | `explanation` | required and non-empty |

The question's position becomes `sort_order`.
