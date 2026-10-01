---
title: "Seccomp for Kubernetes workloads: from RuntimeDefault to application profiles"
slug: seccomp-kubernetes
description: "Record, review, and roll out application seccomp profiles for Kubernetes, with errno compatibility, logging, distroless verification, and new-node handling."
type: guide
publishedAt: 2026-10-01
draft: true
authors:
  - rawkode
technologies:
  - kubernetes
---

If you build a seccomp profile by starting your API and hitting its health endpoint, you've only recorded what it needs to do those two things. When a database connection drops or a worker reloads, the application may need a syscall that never made it into the recording, and your new profile can block it.

We'll work through that problem with one API, starting with `RuntimeDefault` and using the Security Profiles Operator to record, review, and test a custom profile. Along the way, we'll deal with library fallbacks, verification in a distroless container, and what happens when the API reaches a new node before its profile does.

## Start with RuntimeDefault

On a conventional Linux container runtime, your application shares the node's kernel, even if you've removed the shell and run it as a non-root user. Those are useful precautions, but the application still reaches the kernel through system calls, including any calls an attacker can make after compromising it.

Seccomp lets you restrict which of those calls the application can make. If it never needs a particular syscall, blocking it removes one route into kernel behaviour that an attacker might otherwise reach. That makes seccomp a useful addition to kernel patching, restricted credentials and capabilities, and network controls.

The first step is to enable `RuntimeDefault` in your Deployment's Pod template, which gives you the runtime's baseline policy while you work out whether a custom profile is worth maintaining:

```yaml
spec:
  template:
    spec:
      securityContext:
        seccompProfile:
          type: RuntimeDefault
```

Your containers inherit this setting unless they specify their own profile, although privileged containers run unconfined. Because the runtime supplies the rules, changing the runtime or its version can also change the policy. The [Kubernetes seccomp reference](https://kubernetes.io/docs/reference/node/seccomp/) describes how Kubernetes selects the profile.

Keep the field explicit, because omitting it leaves the container `Unconfined` unless the node has seccomp defaulting enabled. Setting `RuntimeDefault` also satisfies the seccomp requirement in the [Restricted Pod Security Standard](https://kubernetes.io/docs/concepts/security/pod-security-standards/#restricted).

## Decide whether a custom profile is worth maintaining

The runtime's default has to accommodate many applications, so it allows operations your API may never need. A custom profile can restrict those permissions further, but you're also taking on the work of testing it whenever the application, its dependencies, the base image, or the runtime changes. Once you ship a profile, maintaining it becomes part of releasing the application.

That work is worth considering for workloads that accept untrusted input, share nodes with other tenants, or expose components where code execution vulnerabilities are a realistic concern. Before taking it on, though, you need tests that exercise more than startup and a health check; until you have that coverage, keep `RuntimeDefault`.

If you're running hostile or mutually untrusted workloads, you should also look at the isolation boundary itself. [gVisor](https://gvisor.dev/docs/) implements an application kernel in userspace, while [Kata Containers](https://github.com/kata-containers/kata-containers) runs workloads in lightweight virtual machines. Both can be integrated through Kubernetes RuntimeClass when the corresponding runtime handler is installed.

You'll need to check their compatibility, performance, and platform requirements against your workload, but they address an isolation decision that a shorter syscall list alone can't resolve: how the application is separated from the host kernel.

## Record the API where it runs

The Security Profiles Operator, or SPO, handles both recording workloads and distributing profile files to nodes. These examples target [SPO 1.1.0](https://github.com/kubernetes-sigs/security-profiles-operator/releases/tag/v1.1.0), with API details checked against upstream documentation and source on 1 October 2026. One detail to keep in mind as you name resources: `ProfileRecording` is namespaced, but `SeccompProfile` is cluster-scoped, so profile names need to be unique across your application namespaces.

Use the release's [installation guide](https://github.com/kubernetes-sigs/security-profiles-operator/blob/v1.1.0/installation.md) to prepare a controlled Linux test cluster. An ordinary installation requires cert-manager, and BPF recording also needs kernel BTF at `/sys/kernel/btf/vmlinux`, along with permission to run the privileged recorder and host-PID daemon.

With SPO installed in `security-profiles-operator`, enable the recorder:

```sh
kubectl -n security-profiles-operator patch spod spod --type=merge \
  -p '{"spec":{"enricher":{"enableBpfRecorder":true}}}'
```

The operator adds the BPF recorder to the DaemonSet asynchronously, so check that it has appeared in the Pod template before checking the rollout. Otherwise, this command can report that the previous revision is healthy while the recorder is still being configured:

```sh
kubectl -n security-profiles-operator rollout status daemonset/spod \
  --timeout=120s
```

Once the rollout finishes, confirm that the recorder containers are present and ready, and inspect their startup logs on the nodes you'll use. Missing BTF or a recorder that can't start needs fixing before you create the application, otherwise there won't be a recording to review.

Next, create a namespace and opt it into recording with the label that enables SPO's recording webhook:

```sh
kubectl create namespace seccomp-demo
kubectl label namespace seccomp-demo spo.x-k8s.io/enable-recording=true
```

Within that namespace, the `ProfileRecording` selects the Pods and containers to record. Save this as `recording.yaml`:

```yaml
apiVersion: security-profiles-operator.x-k8s.io/v1
kind: ProfileRecording
metadata:
  name: seccomp-demo-api-v1
  namespace: seccomp-demo
spec:
  kind: SeccompProfile
  recorder: Bpf
  mergeStrategy: Containers
  disableProfileAfterRecording: true
  containers:
    - api
  podSelector:
    matchLabels:
      app: seccomp-demo-api
```

This selects container `api` in Pods labelled `app: seccomp-demo-api`. With `mergeStrategy: Containers`, SPO combines recordings from replicas by container name, while `disableProfileAfterRecording: true` keeps the generated profile disabled so you can review it before explicitly enabling it.

Apply the recording before creating the application Pods, because the webhook instruments new Pods and can't attach to a container that's already running:

```sh
kubectl apply -f recording.yaml
```

For the Deployment, use your API's image and normal configuration so the recording reflects what you actually deploy. Replace the example image below with yours, preferably pinned by digest, and include its usual arguments, environment, volumes, and probes. The template assumes an image that runs as a non-root user; keep the resource and container names so the later commands match.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: seccomp-demo-api
  namespace: seccomp-demo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: seccomp-demo-api
  template:
    metadata:
      labels:
        app: seccomp-demo-api
    spec:
      securityContext:
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: api
          image: registry.example.com/team/api:1.0.0
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
```

Save the adapted Deployment as `api.yaml`, then start it:

```sh
kubectl apply -f api.yaml
kubectl -n seccomp-demo rollout status deployment/seccomp-demo-api \
  --timeout=120s
```

The new Pod matches the recording selector and keeps `RuntimeDefault` while the BPF recorder observes it. Check that the architecture, libraries, runtime, and configuration match production, and if the application fails under the baseline, investigate that before trying to build a custom policy around it.

## Exercise the paths a health check misses

Start the recording exercise with your integration tests, then add any operational paths they miss, including how the application recovers when something fails:

| Scenario | Behaviour to exercise |
| --- | --- |
| Startup | Configuration loading, migrations, initial DNS and TLS connections |
| Normal requests | Every supported endpoint, upload, and background job |
| Dependency failure | Timeouts, connection loss, retry, and reconnection |
| Filesystem activity | Temporary files, cache writes, cleanup, and log rotation |
| Process lifecycle | Worker creation, reload, graceful shutdown, and signals |
| Operational tasks | Backups, scheduled jobs, and maintenance commands |
| Supported environments | Every production architecture and relevant feature configuration |

Repeating one request thousands of times won't tell you much about the paths it never touches. Spend that time exercising different behaviour, including graceful termination, so the recording captures how the application exits as well as how it starts.

Record the API, migration container, and telemetry sidecar separately, because combining their observations gives each container permissions that only another container needed. For the same reason, keep investigative commands out of the application container during recording: a shell or debugging binary can add syscalls that the application itself never uses.

Different architectures or incompatible environments also need separate recordings. SPO's container merge retains an architecture list from a partial profile, so merging heterogeneous recordings won't give you a portable policy.

## Finish collection before merging

Once you've exercised the workload, scale the test Deployment down so Kubernetes stops creating replacement Pods:

```sh
kubectl -n seccomp-demo scale deployment/seccomp-demo-api --replicas=0
```

Now inspect the partial profiles produced by the recording:

```sh
kubectl get seccompprofiles \
  -l 'spo.x-k8s.io/recording-id=seccomp-demo-api-v1,spo.x-k8s.io/recording-namespace=seccomp-demo' \
  -o yaml
```

Graceful termination finishes each recording, but SPO still needs time to collect the results after the Pod disappears. Wait until you can see the expected partial profile for every recorded Pod and container before deleting the recording; if one is missing, check the recorder logs to find out why.

Once all partials are saved, delete the `ProfileRecording` to trigger the container merge:

```sh
kubectl -n seccomp-demo delete profilerecording seccomp-demo-api-v1
kubectl get seccompprofile seccomp-demo-api-v1-api -o yaml
```

You should now have a merged profile named `seccomp-demo-api-v1-api`. If the merge fails, inspect the operator's reconciliation errors before using any output; the [recording guide](https://github.com/kubernetes-sigs/security-profiles-operator/blob/v1.1.0/profiles.md#recording-based-on-ebpf-instrumentation) covers this collection workflow.

To put that profile under version control, save a clean resource containing `apiVersion`, `kind`, `metadata.name`, and `spec`, without status or server-generated metadata. Call the reviewed version `seccomp-demo-api-v1-reviewed` and leave `spec.state: Disabled` while you inspect it. Since `SeccompProfile` is cluster-scoped, there's no `metadata.namespace` to include.

## Review permissions and error behaviour

When you select `Localhost`, Kubernetes uses your profile in place of `RuntimeDefault`, so you need to compare the candidate with the actual runtime baseline before switching. That comparison includes argument restrictions: a profile with fewer syscall names can still grant wider permissions if it drops the restrictions the runtime applied.

The BPF candidate records syscall names without argument constraints. For example, if the baseline permits `socket` only when its first argument is `AF_INET`, replacing it with an unrestricted `socket` rule also allows other families, such as `AF_VSOCK`. Keep the argument restrictions your policy needs as you review the recording.

There are limits to what those restrictions can express. Ordinary seccomp filters can inspect numeric arguments, but they can't dereference a pointer to inspect a filename. If you need filesystem access control, an application or launcher can apply [Landlock](https://docs.kernel.org/userspace-api/landlock.html) restrictions on a supported kernel, although Kubernetes' `seccompProfile` setting doesn't configure them.

You also need to check what happens when a call is denied, because the error can determine what the application does next. In glibc 2.42's [internal clone helper](https://github.com/bminor/glibc/blob/glibc-2.42/sysdeps/unix/sysv/linux/clone-internal.c#L94-L109), `ENOSYS` from `clone3` triggers a fallback to `clone`, while `EPERM` takes a different path. Both deny the call, but they can produce different application behaviour, and a library update can change that behaviour without any change to your own source.

If your tested application needs that fallback, a targeted rule can preserve it. This fragment belongs under `spec.syscalls` for an amd64 or arm64 profile, where errno 38 is `ENOSYS`:

```yaml
- names: [clone3]
  action: SCMP_ACT_ERRNO
  errnoRet: 38
```

Remove `clone3` from any existing allow rule before adding the denial, then verify that the caller falls back as expected and that the older syscall is permitted. This rule depends on the behaviour of the caller: other libraries and syscalls have different fallback conditions, so returning `ENOSYS` for everything can change feature detection across the application.

SPO's resource also differs from the OCI JSON format here: OCI supports `defaultErrnoRet`, but SPO 1.1.0 exposes per-rule `errnoRet` and has no `spec.defaultErrnoRet` field. Use the release's [SeccompProfile schema](https://github.com/kubernetes-sigs/security-profiles-operator/blob/v1.1.0/deploy/base-crds/crds/seccompprofile.yaml) when editing the resource, and check the observed errno under your runtime, which may add compatibility handling of its own.

## Install a logging version first

Before enforcing the candidate, give yourself a way to see which calls the recording missed without blocking all of them. Copy the reviewed profile to `observe-profile.yaml`, keeping its architectures and reviewed syscall rules, then change these fields:

```yaml
# Fragment of the copied SeccompProfile
metadata:
  name: seccomp-demo-api-v1-observe
spec:
  state: Enabled
  defaultAction: SCMP_ACT_LOG
```

With `SCMP_ACT_LOG` as the default, calls that don't match a rule are permitted and eligible for logging, while your allow rules continue to work as before. Any explicit denial rules still deny, so this isn't a way to turn off the whole policy. It does broaden access for the exercise, which is why it belongs in isolated staging with test data.

For seccomp enrichment in SPO 1.1.0, configure the audit-log source:

```sh
kubectl -n security-profiles-operator patch spod spod --type=merge \
  -p '{"spec":{"enricher":{"enableLogEnricher":true,"logEnricherSource":"Auditd"}}}'
```

Wait until the daemon template includes `log-enricher`, then check the new rollout and confirm those containers are ready:

```sh
kubectl -n security-profiles-operator rollout status daemonset/spod \
  --timeout=120s
```

The enricher reads auditd output from `/var/log/audit/audit.log`, with a documented fallback to `/var/log/syslog`, so you'll need a working audit path on the node. Check that `kernel.seccomp.actions_logged` includes `log` and that records actually reach that path; the [SPO logging prerequisites](https://github.com/kubernetes-sigs/security-profiles-operator/blob/v1.1.0/profiles.md#recording-based-on-audit-log) and [kernel action semantics](https://docs.kernel.org/userspace-api/seccomp_filter.html#return-values) explain the requirements.

Install the observation profile and read its node-relative path:

```sh
kubectl apply -f observe-profile.yaml
kubectl wait --for=jsonpath='{.status.status}'=Installed \
  seccompprofile/seccomp-demo-api-v1-observe --timeout=120s
kubectl get seccompprofile seccomp-demo-api-v1-observe \
  -o jsonpath='{.status.localhostProfile}{"\n"}'
```

Once the profile reports `Installed`, the final command should return the path to its generated JSON file. Use that returned path in the Deployment, and check that the profile has been installed on every node eligible to run the application before starting it.

The API container gets the custom profile, while the Pod's `RuntimeDefault` setting remains the default for other containers:

```yaml
# Fragment of the Deployment's Pod template
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: api
      securityContext:
        seccompProfile:
          type: Localhost
          localhostProfile: <path-returned-by-the-operator>
```

Add the container profile to `api.yaml`, preserving its other settings, set `replicas: 1`, and apply it to create a fresh API container with the observation filter. With the enricher running, repeat the workload exercise and inspect the enriched events:

```sh
kubectl -n security-profiles-operator logs \
  -l name=spod -c log-enricher --since=10m --prefix=true
```

This reads logs from the selected daemons, including the one on the application node, where you should look for syscall events attributed to your test workload. For each unexpected call, work out which code path needs it before adding a permission to the allowlist.

An empty log needs checking too, because it can mean missing events, attribution failures, or dropped audit records. To check the logging path, use the harmless probe later in this article with a disposable observation copy named `seccomp-demo-api-v1-log-check`, removing `getppid` from existing rules so the `SCMP_ACT_LOG` default handles it.

Install that version, read its path, and start fresh test containers before running the probe. Once you've confirmed that its event arrives, return to the observation candidate. Even with a working logging path and no unexpected events, you'll still need to rerun the scenario table under enforcement.

## Enforce the reviewed version and canary it

Once the logging exercise and review are complete, set `spec.state: Enabled` in `reviewed-profile.yaml`. Keep the reviewed enforcement default action, typically `SCMP_ACT_ERRNO`.

```sh
kubectl apply -f reviewed-profile.yaml
kubectl wait --for=jsonpath='{.status.status}'=Installed \
  seccompprofile/seccomp-demo-api-v1-reviewed --timeout=120s
kubectl get seccompprofile seccomp-demo-api-v1-reviewed \
  -o jsonpath='{.status.localhostProfile}{"\n"}'
```

Use this version's returned path in `api.yaml` and apply the Deployment to start fresh containers, then rerun the complete exercise. This is where you check that startup, fallback paths, normal requests, graceful shutdown, and recovery after failures all work when the policy can actually block calls.

If a test fails with `EPERM`, don't assume the nearest syscall in a log needs adding to the profile. Filesystem permissions or another security control can produce the same error, so use the logging evidence and a controlled comparison to establish which syscall and code path are involved before changing a permission.

Once those tests pass, canary the profile before rolling it out, keeping the previous version available for rollback. Updating a profile file won't replace the filter in an existing process, so both a new version and a rollback need new containers to pick up the intended rules.

### What happens when a node joins?

The `Localhost` profile's file has to be on the node before the container can start. If the scheduler places the API on a newly joined node before SPO installs it, container creation fails and Kubernetes retries, commonly reporting `CreateContainerError`. There's no automatic fallback to `RuntimeDefault` while the file is missing.

If that startup delay is acceptable, you can let Kubernetes retry while SPO installs the profile. If it isn't, have node provisioning register new nodes with a `NoSchedule` startup taint that the SPO daemon tolerates, then remove the taint only after every required profile reports `Installed` for that node. A required node-affinity label maintained on the same condition is another option.

You'll need to implement that gate in platform provisioning or a controller, since a ready SPO daemon doesn't guarantee that the files exist, and one aggregate status check won't protect nodes added later. The [installation guide](https://github.com/kubernetes-sigs/security-profiles-operator/blob/v1.1.0/installation.md#constrain-spod-scheduling) describes the daemon scheduling configuration you'll need for it.

## Verify a distroless container

You can check whether the application has a filter even when its image has no shell. An administrator can find the application's host PID through the node's container runtime and read `/proc/<pid>/status` on the node.

A [targeted ephemeral debug container](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/#example-debugging-using-ephemeral-containers) can also inspect that process when the runtime supports joining its PID namespace, or you can use a Pod configured with a shared process namespace.

Whichever route you use, read the status for the application's PID: `Seccomp: 2` tells you that process is in filter mode, but doesn't identify which rules it has. To check a particular rule's behaviour, combine the expected profile path with a test inside the application container. The debug container has its own seccomp profile, so running a probe there tests the debugger's rules even if it can see the application's processes.

### Run a harmless syscall probe in the API container

Use a disposable copy of the workload and profile for this test. Save the following as `seccomp-probe.c`:

```c
#include <errno.h>
#include <stdio.h>
#include <sys/syscall.h>
#include <unistd.h>

int main(void) {
    long parent = syscall(SYS_getppid);
    if (parent == -1) {
        perror("getppid");
        return 1;
    }
    printf("getppid=%ld\n", parent);
    return 0;
}
```

Build it on Linux for the application's architecture with a static C toolchain:

```sh
cc -static -Os -o seccomp-probe seccomp-probe.c
kubectl -n seccomp-demo create configmap seccomp-probe \
  --from-file=seccomp-probe
```

The binary calls `getppid` directly and reports the result, and mounting it from the ConfigMap lets you run it in the test container without adding a shell or compiler to the image. Just keep the binary below the ConfigMap size limit.

Add these fields to the test Deployment's Pod template, preserving the API container's image, profile, and other settings:

```yaml
# Fragment of the Deployment's Pod template
spec:
  volumes:
    - name: seccomp-probe
      configMap:
        name: seccomp-probe
        defaultMode: 0555
  containers:
    - name: api
      volumeMounts:
        - name: seccomp-probe
          mountPath: /diagnostics
          readOnly: true
```

For the control run, replace the API container's entire `seccompProfile` field with `type: RuntimeDefault`, then apply the adapted Deployment and execute the binary directly:

```sh
kubectl apply -f api.yaml
kubectl -n seccomp-demo rollout status deployment/seccomp-demo-api \
  --timeout=120s
kubectl -n seccomp-demo exec deployment/seccomp-demo-api -c api -- \
  /diagnostics/seccomp-probe
```

You should get a parent PID and exit status zero, confirming that the binary can run in this container. Keep the image, mount, and other security settings constant for the remaining runs so you can compare the effect of changing the profile.

Next, create a disposable copy of the reviewed candidate named `seccomp-demo-api-v1-probe-control`. Remove `getppid` from existing rules and add this rule under `spec.syscalls`:

```yaml
- names: [getppid]
  action: SCMP_ACT_ALLOW
```

Install this version, read its path, and start fresh test containers with it, then check that the probe prints a parent PID and exits successfully. That control matters because the static helper may need startup or output syscalls that the API recording missed; you need to know it works before testing whether the profile can deny `getppid`.

If extra permissions are needed to run the helper, add them only to these validation copies. They support the test binary and shouldn't make their way into the production policy.

Copy that working control as `seccomp-demo-api-v1-probe` and replace only its `getppid` rule:

```yaml
- names: [getppid]
  action: SCMP_ACT_ERRNO
  errnoRet: 1
```

On amd64 and arm64, errno 1 is `EPERM`. Install this version, wait for distribution, and use its returned path to start fresh API containers, checking that the application can start with the temporary rule before running the same probe command again.

This time, you should get `getppid: Operation not permitted` and a non-zero exit status. Since the helper worked under the control profile and you've changed only its `getppid` rule, the comparison tests that denial inside the application container. If the helper fails before reaching the call, you'll need to diagnose its startup separately.

The validation profiles stay out of production; use the application's full integration exercise to check that the reviewed profile is compatible with the API itself.

## Ship the profile with the application

Store the reviewed profile alongside the application, tied to the image digest you tested, so you can tell which policy was validated for each release. Keep the architecture, runtime, node environment, and exercised scenarios with that version's validation evidence too.

For a local Linux workflow, SPO's [spoc CLI](https://github.com/kubernetes-sigs/security-profiles-operator/blob/v1.1.0/cli.md) can record a command and convert the output:

```sh
sudo spoc record -o api-candidate.yaml ./api
spoc convert -o api-candidate.json api-candidate.yaml
```

Exercise the application while it runs, then terminate it to finish the recording. The CLI adds OCI compatibility syscalls by default, so review those alongside the observed calls before testing the resulting profile with the container image and Kubernetes runtime you'll deploy.

When the application, libraries, base image, runtime, architecture, or relevant node environment changes, make a new recording and review the diff before accepting it. Repeat the logging and enforcement tests for that version, then roll it out under a new profile name with the previous version still available for rollback.
