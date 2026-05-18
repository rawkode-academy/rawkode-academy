# Design: cgroups v1 vs v2 Deep Dive Article

## Overview

A single long-form interactive article (~4,500 words + 4 React interactive components) covering the history, architecture, and practical implications of Linux cgroups v1 and v2, from kernel fundamentals through Kubernetes operations.

**Quality bar:** samwho.dev — interactive visualizations, progressive disclosure, hands-on "try it" moments, generous typography and spacing.

**Slug:** `cgroups-v1-vs-v2`
**Type:** `guide`
**Technologies:** `linux`, `kubernetes`, `containers`
**Author:** `rawkode`
**Tone:** Rawkode voice — conversational, opinionated, first person. "Let me show you why this matters" energy.

## File Structure

```
content/articles/cgroups-v1-vs-v2/
├── index.mdx
└── cover.png

projects/rawkode.academy/website/src/components/articles/cgroups/
├── CgroupTimeline.tsx
├── HierarchyExplorer.tsx
├── ResourceSimulator.tsx
└── PodCgroupMapper.tsx
```

Components live in the website's `src/components/` directory (not alongside the MDX content) because Astro content collections require imports from `@/components/`. Each component is a React island loaded via `client:visible` directive. Styled with Tailwind CSS v4 (consistent with the site).

**Frontmatter fields:**
```yaml
title: "cgroups: From Chaos to Control"
description: "A deep dive into Linux cgroups v1 vs v2 — the history, the architecture, and what it means for Kubernetes. Interactive visualizations included."
type: guide
slug: cgroups-v1-vs-v2
cover:
  image: "./cover.png"
  alt: "..."
openGraph:
  title: "cgroups v1 vs v2"
  subtitle: "The kernel subsystem under every container"
publishedAt: 2026-05-18
draft: false
authors:
  - rawkode
technologies:
  - linux
  - kubernetes
```

## Article Sections

### 1. Opening Hook

Start with a relatable debugging moment: you're troubleshooting a container OOM kill, you run `cat /proc/<pid>/cgroup`, and get 12 lines of cryptic mount paths. What is all this? Why is the same process in a dozen different places? This is cgroupsv1. Let's talk about how we got here and how v2 fixed it.

### 2. "What Even Is a Cgroup?" (~600 words)

Accessible foundation layer for readers who know containers but not kernel internals.

Key concepts:
- A cgroup is a directory in a virtual filesystem
- Processes are listed in `cgroup.procs` files
- Controllers are knobs attached to those directories (cpu, memory, io, pids)
- The kernel reads these files to enforce limits

Hands-on moment: `ls /sys/fs/cgroup/` on a modern system — readers can run this themselves.

Mental model to establish: cgroup = directory, process membership = file entry, resource limit = controller file value.

### 3. "2008: The Accidental Architecture" (~500 words)

The history narrative.

Timeline:
- 2006: Paul Menage proposes "process containers" (renamed to cgroups to avoid confusion with OS-level containers)
- 2007: Renamed to "control groups" — cgroups
- 2008: Merged into Linux 2.6.24
- 2008-2013: Controllers added organically — cpu, cpuacct, cpuset, memory, blkio, devices, freezer, net_cls, net_prio, perf_event, hugetlb
- 2013: Tejun Heo posts RFC for unified hierarchy
- 2016: cgroupsv2 merged in Linux 4.5 (March 2016), marked "experimental"
- 2016: cgroup namespace support added in Linux 4.6 (May 2016)
- 2019: Fedora 31 defaults to cgroupsv2
- 2020: cgroupsv2 declared stable (Linux 5.8, "complete" status)
- 2022: Ubuntu 22.04, Kubernetes 1.25 GA cgroupsv2 support
- 2023: RHEL 9 defaults to cgroupsv2
- 2025: Most managed Kubernetes providers default to cgroupsv2

**Interactive component: `<CgroupTimeline />`**
- Horizontal scrollable timeline
- Kernel version markers with clickable detail popovers
- Color-coded: red for v1 milestones, green for v2 milestones, blue for Kubernetes milestones

### 4. "cgroupsv1: The Wild West" (~800 words)

The problem statement — make readers feel the pain before showing the solution.

**Interactive component: `<HierarchyExplorer />` (v1 tab active)**

Core problems to cover with concrete examples:

**Multiple independent hierarchies:**
- Each controller (cpu, memory, blkio, etc.) has its own mount point under `/sys/fs/cgroup/<controller>/`
- The same process appears in every hierarchy separately
- Show `cat /proc/self/cgroup` output on v1: 12+ lines, one per controller hierarchy

**Race conditions and inconsistency:**
- Moving a process in the `cpu` hierarchy doesn't move it in `memory` — they're completely independent
- No atomic "move this process in all controllers at once" operation
- Container runtimes had to implement their own synchronization logic

**Interface inconsistencies:**
- `cpu.shares` (relative weight, 2-262144) vs `cpu.cfs_quota_us`/`cpu.cfs_period_us` (absolute bandwidth) — two completely different mental models for limiting CPU
- `cpuacct` existing as a separate controller from `cpu` — split for historical reasons, confusing in practice
- Memory: `memory.limit_in_bytes` (hard limit), `memory.soft_limit_in_bytes` (advisory, mostly useless), `memory.memsw.limit_in_bytes` (memory + swap combined) — three different files, three different behaviors

**The `clone_children` problem:**
- `cpuset` controller required `clone_children` flag to propagate settings to child cgroups
- Other controllers didn't use this mechanism
- Led to bugs where newly created child cgroups had no cpuset configuration

**No unified resource accounting:**
- Impossible to answer "how much total resource is this process group using?" without reading from every hierarchy separately
- Monitoring tools had to stitch together data from 12+ mount points

### 5. "cgroupsv2: The Unified Redesign" (~800 words)

The solution — Tejun Heo's multi-year effort.

**Interactive component: `<HierarchyExplorer />` (toggle to v2 tab)**

Key design decisions:

**Single unified hierarchy:**
- One mount point: `/sys/fs/cgroup/`
- All controllers attached to the same tree
- `cat /proc/self/cgroup` returns one line: `0::/user.slice/user-1000.slice/session-2.scope`
- Process moves are atomic across all controllers

**The "no internal processes" rule:**
- A cgroup that has children cannot have processes directly in it (with exceptions for threaded cgroups)
- Why: prevents ambiguity in resource accounting — if a parent has processes AND children, who gets charged for the parent's processes?
- The kernel enforces this by rejecting writes to `cgroup.procs` in a cgroup that has child cgroups (for domain cgroups). Threaded cgroups are the exception — `cgroup.type` can be set to "threaded" to opt into a different model where threads can exist alongside child cgroups within a threaded subtree.

**Explicit controller delegation via `cgroup.subtree_control`:**
- Parent explicitly enables which controllers its children can use
- `echo "+cpu +memory -io" > cgroup.subtree_control`
- Clean permission model — a cgroup can only use controllers its parent delegated

**Threaded cgroups:**
- `cgroup.type` can be set to "threaded" for thread-level resource control
- Allows individual threads within a process to have different CPU or cpuset constraints
- The threaded subtree root owns the resource domain for memory and IO

**PSI — Pressure Stall Information (the killer feature):**
- `cpu.pressure`, `memory.pressure`, `io.pressure` files on every cgroup
- Reports how much time tasks are stalled waiting for each resource
- Format: `some avg10=0.50 avg60=0.25 avg300=0.10 total=12345` / `full avg10=...`
- Enables proactive resource management: detect pressure before OOM kills happen
- `memory.events` file tracks OOM kills, reclaim activity, high watermark hits

### 6. "The Technical Delta" (~700 words)

Controller-by-controller migration guide.

**Interactive component: `<ResourceSimulator />`**
- Sliders for CPU, memory, IO limits
- Left panel: control values being adjusted
- Right panel: live preview of the resulting cgroup file contents
- Toggle between v1 and v2 file formats to see the difference

**CPU controller:**

| v1 | v2 | Notes |
|----|-----|-------|
| `cpu.shares` (2-262144) | `cpu.weight` (1-10000, default 100) | Relative weight, rescaled range |
| `cpu.cfs_quota_us` / `cpu.cfs_period_us` | `cpu.max` ("$QUOTA $PERIOD") | Single file, cleaner |
| `cpuacct.usage` (separate controller) | `cpu.stat` (integrated) | No more split controller |
| `cpuset.cpus` (separate hierarchy) | `cpuset.cpus` (same hierarchy) | Unified with everything else |

**Memory controller:**

| v1 | v2 | Notes |
|----|-----|-------|
| `memory.limit_in_bytes` | `memory.max` | Hard limit, OOM kill trigger |
| `memory.soft_limit_in_bytes` | `memory.high` | v2 actually applies backpressure (throttles allocation), v1 was advisory only |
| `memory.memsw.limit_in_bytes` | `memory.swap.max` | Separate swap control |
| `memory.usage_in_bytes` | `memory.current` | Cleaner naming |
| N/A | `memory.low` / `memory.min` | New: memory protection (guaranteed minimum) |
| N/A | `memory.pressure` | New: PSI metrics |

**IO controller:**

| v1 | v2 | Notes |
|----|-----|-------|
| `blkio.weight` | `io.weight` | Renamed controller entirely (blkio → io) |
| `blkio.throttle.read_bps_device` | `io.max` | Unified format: `$MAJ:$MIN rbps=$X wbps=$Y riops=$Z wiops=$W` |
| N/A | `io.latency` | New: latency-based IO control — specify target latency, kernel throttles to achieve it |
| N/A | `io.pressure` | New: PSI metrics |

**PIDs controller:**
- Largely unchanged: `pids.max` in both versions
- v2 adds `pids.peak` (high watermark tracking)

**Interface cleanup patterns:**
- No more `_in_bytes` suffixes
- Consistent file naming: `<controller>.<metric>`
- `max` for hard limits, `high` for soft limits, `low`/`min` for protection
- Values in bytes (not pages), "max" string means unlimited

### 7. "Kubernetes and Cgroups" (~800 words)

From kernel to kubelet.

**Interactive component: `<PodCgroupMapper />`**
- Left panel: Kubernetes pod spec with resource requests/limits
- Right panel: resulting cgroup hierarchy path and file values
- Toggle between QoS classes (Guaranteed/Burstable/BestEffort) — pod spec and cgroup output update together
- Toggle between cgroupfs and systemd driver to see path differences

**How the kubelet builds the cgroup tree (systemd driver, cgroupsv2):**

```
/sys/fs/cgroup/
└── kubepods.slice/
    ├── kubepods-burstable.slice/
    │   └── kubepods-burstable-pod<uid>.slice/
    │       ├── cri-containerd-<container-id>.scope  # app container
    │       └── cri-containerd-<container-id>.scope  # sidecar
    ├── kubepods-besteffort.slice/
    │   └── kubepods-besteffort-pod<uid>.slice/
    │       └── cri-containerd-<container-id>.scope
    └── kubepods-pod<uid>.slice/  # Guaranteed pods go here directly
        └── cri-containerd-<container-id>.scope
```

**QoS class → cgroup mapping:**

- **Guaranteed:** `requests == limits` for all containers. Pod gets its own slice directly under `kubepods.slice`. Gets highest OOM score adjustment (-997), last to be killed.
- **Burstable:** `requests < limits` (or limits set without requests). Goes under `kubepods-burstable.slice`. OOM score adjusted based on memory request relative to node capacity.
- **BestEffort:** No requests or limits set. Goes under `kubepods-besteffort.slice`. First to be killed under memory pressure (OOM score 1000).

**How resource specs map to cgroup files:**
- `resources.requests.cpu: "500m"` → `cpu.weight` (proportional to request, used for scheduling)
- `resources.limits.cpu: "500m"` → `cpu.max` = `50000 100000` (50ms quota per 100ms period)
- `resources.requests.memory: "256Mi"` → `memory.min` or `memory.low` (memory protection)
- `resources.limits.memory: "256Mi"` → `memory.max` = `268435456`

**The cgroup driver story:**
- `cgroupfs` driver: kubelet directly manipulates cgroup filesystem. Simple but creates a split-brain problem — systemd doesn't know about kubelet's cgroups, kubelet doesn't know about systemd's. Can lead to instability under resource pressure.
- `systemd` driver: kubelet creates systemd transient units (slices and scopes). Systemd manages the cgroup tree. Single source of truth. Required for cgroupsv2 in production.
- Kubernetes 1.22+: systemd driver is the default. cgroupfs driver is deprecated for cgroupsv2.

**How monitoring reads from cgroups:**
- `kubectl top` → metrics-server → kubelet `/metrics/resource` endpoint → reads `cpu.stat` and `memory.current` from cgroup files
- cAdvisor (embedded in kubelet) scrapes cgroup filesystem for container-level metrics
- On v2, cAdvisor reads from a single hierarchy instead of stitching together 12 mount points

### 8. "Migration and Operations" (~500 words)

Practical guidance.

**Checking your version:**
```bash
# cgroupsv2: returns "cgroup2fs"
stat -fc %T /sys/fs/cgroup/

# cgroupsv1: returns "tmpfs" (because it's a tmpfs with multiple controller mounts)
stat -fc %T /sys/fs/cgroup/

# Or check for the unified hierarchy file
test -f /sys/fs/cgroup/cgroup.controllers && echo "v2" || echo "v1"
```

**Managed Kubernetes provider status (as of 2025):**
- **GKE:** cgroupsv2 default since 1.26+ with Container-Optimized OS
- **EKS:** cgroupsv2 default on AL2023 AMIs (EKS 1.30+)
- **AKS:** cgroupsv2 default on Ubuntu 22.04 node images
- **Talos Linux:** cgroupsv2 only (no v1 support)

**Linux distro defaults:**
- Ubuntu 22.04+: cgroupsv2
- Fedora 31+: cgroupsv2
- RHEL 9 / CentOS Stream 9: cgroupsv2
- Debian 11+: cgroupsv2
- Flatcar Container Linux: cgroupsv2

**eBPF advantages on v2:**
- BPF programs can attach to the unified cgroup hierarchy for network filtering (`BPF_PROG_TYPE_CGROUP_SKB`)
- Device access control via BPF (`BPF_PROG_TYPE_CGROUP_DEVICE`) replaces the old `devices` controller
- Cilium, Calico, and other CNI plugins benefit from simplified cgroup attachment points on v2

**PSI-based monitoring:**
- Proactive: watch `memory.pressure` for early warning signs before OOM kills
- `some` = at least one task stalled, `full` = all tasks stalled
- Kubernetes 1.29+: Pod-level resource monitoring can use PSI metrics from cgroupsv2
- Combine with `memory.events` (`oom_kill`, `oom_group_kill` counters) for complete picture

**Common migration gotchas:**
- Third-party monitoring tools that hardcode `/sys/fs/cgroup/memory/docker/` paths (v1-specific)
- Container runtimes (Docker, containerd, CRI-O) need config updates for v2
- Java applications: JVM cgroup memory detection works differently on v2 (fixed in JDK 15+, backported to 8u372+, 11.0.16+)
- Older runc versions (< 1.1) have incomplete cgroupsv2 support
- Hybrid mode (v1 + v2 mounted simultaneously) exists but is a transitional state, not a destination

### 9. "Where We're Going" (~300 words)

- cgroupsv1 freeze: no new controllers being added to v1, maintenance-only
- Deprecation: kernel docs mark v1 as deprecated, eventual removal (no firm date but kernel community consensus is that v1's days are numbered)
- Future developments: improved NUMA-aware memory placement, better rootless container delegation, potential for per-cgroup scheduling policies
- Closing: cgroups are the invisible foundation under every container. Understanding them makes you better at debugging, capacity planning, and architecting systems. The next time a pod gets OOM killed, you'll know exactly where to look — and why.

## Interactive Components Specification

### `<CgroupTimeline />`

**Purpose:** Visualize the history of cgroups from 2006 to present.

**Behavior:**
- Horizontal scrollable timeline with kernel version markers
- Each marker is clickable, expanding a popover with details (what changed, link to commit/RFC)
- Color-coded: red = v1 milestones, green = v2 milestones, blue = Kubernetes milestones, gray = distro adoption
- Auto-scrolls to "today" marker on load, user can scroll back
- Responsive: horizontal scroll on mobile, full width on desktop

**Data:** Hardcoded array of milestone objects `{ year, month, kernel?, k8s?, label, detail, color }`.

### `<HierarchyExplorer />`

**Purpose:** Let readers toggle between v1 and v2 cgroup hierarchies to see the structural difference.

**Behavior:**
- Tabbed interface: "cgroupsv1" and "cgroupsv2" tabs
- v1 tab: shows 3 separate hierarchy trees (cpu, memory, blkio) with the same processes appearing in each — highlights the fragmentation problem
- v2 tab: shows single unified tree with controller badges on each node
- Tree nodes are expandable/collapsible
- Animated transition when switching tabs (trees morph from fragmented to unified)
- Callout boxes below each view: "The Problem" (v1) / "The Solution" (v2) with key stats
- Process names (nginx, redis) highlighted in orange across all hierarchies to emphasize duplication

**Data:** Hardcoded tree structures representing a realistic Docker/Kubernetes node.

### `<ResourceSimulator />`

**Purpose:** Let readers manipulate resource limits and see the corresponding cgroup file contents.

**Behavior:**
- Left panel: three sliders (CPU, Memory, IO)
  - CPU: 0-100% of one core, displays as `cpu.max` values
  - Memory: 0-1GiB, displays as bytes in `memory.max`
  - IO: 0-10000 IOPS, displays in `io.max` format
- Right panel: live-updating terminal preview showing `cat` output for each cgroup file
- Toggle between v1 and v2 file formats
  - v1: shows `cpu.cfs_quota_us`, `memory.limit_in_bytes`, `blkio.throttle.read_iops_device`
  - v2: shows `cpu.max`, `memory.max`, `io.max`
- Color-coded: each resource type has consistent color (red=cpu, amber=memory, green=io)
- Shows human-readable annotation below each value (e.g., "50% of one core", "256 MiB")

**Data:** Pure computation — slider value → formatted cgroup file content.

### `<PodCgroupMapper />`

**Purpose:** Show the mapping between a Kubernetes pod spec and the resulting cgroup hierarchy.

**Behavior:**
- Three QoS class buttons at top: Guaranteed, Burstable, BestEffort
- Clicking a class updates both panels simultaneously:
  - Left panel: Kubernetes pod spec YAML (resource requests/limits section)
  - Right panel: resulting cgroup path + file values
- Animated path highlighting when switching QoS classes
- Guaranteed: shows requests == limits, path under `kubepods.slice/` directly
- Burstable: shows requests < limits, path under `kubepods-burstable.slice/`
- BestEffort: shows no resources section, path under `kubepods-besteffort.slice/`
- Secondary toggle: cgroupfs vs systemd driver (changes path format)
- Annotations explaining the OOM score adjustment for each class

**Data:** Hardcoded pod specs and cgroup mappings for each QoS class.

## Review Process

Each implementation phase goes through two review gates before proceeding:

### Gate 1: Fact Check

A dedicated agent reviews the phase output for technical accuracy:
- Kernel version numbers and dates are correct
- cgroup file paths and interfaces match actual kernel documentation
- Controller behavior descriptions are accurate
- Kubernetes version-specific claims are verified
- Managed provider status is current
- Migration gotchas are real, not theoretical

Sources for verification: kernel.org docs, Kubernetes docs, man pages, LKML archives, provider release notes.

### Gate 2: Editorial Review

A dedicated agent reviews the phase output for quality:
- Rawkode voice is consistent — conversational, not textbook
- Progressive disclosure works — each section builds on the last
- Technical density is appropriate for the layered audience
- Interactive components are introduced at natural moments, not shoehorned
- Transitions between sections feel organic
- No AI slop: no unnecessary hedging, no "it's important to note that", no filler
- Code snippets and terminal examples are realistic and runnable

### Phase Schedule

| Phase | Content | Fact Check | Editorial |
|-------|---------|------------|-----------|
| 1 | Sections 1-3 (Opening, Foundations, History) + `<CgroupTimeline />` | Kernel history dates, controller merge versions, Paul Menage attribution | Voice, pacing, hook effectiveness |
| 2 | Sections 4-5 (v1 Deep Dive, v2 Redesign) + `<HierarchyExplorer />` | v1/v2 interface names, file paths, "no internal processes" rule accuracy, PSI format | Technical density balance, v1→v2 narrative arc |
| 3 | Section 6 (Technical Delta) + `<ResourceSimulator />` | Controller comparison tables (every cell), value ranges, conversion math | Table readability, simulator UX |
| 4 | Section 7 (Kubernetes) + `<PodCgroupMapper />` | QoS class behavior, cgroup paths, OOM score values, driver differences, metrics-server chain | K8s audience gets enough depth, mapper is intuitive |
| 5 | Sections 8-9 (Migration, Closing) | Provider defaults are current, distro versions correct, JVM version numbers, eBPF program types | Closing lands, actionable takeaways |
| 6 | Full article integration + final pass | End-to-end consistency, no contradictions between sections | Flow, pacing, overall read-through quality |
