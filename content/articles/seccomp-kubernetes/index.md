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

A generated seccomp profile can let your API pass its health check and still break its first database reconnect or worker reload. The recorder captured calls from the paths you exercised. Its allowlist can block calls needed by the rest of the application.

Start with `RuntimeDefault`, record a representative workload, review the permissions, and test a versioned profile before enforcing it. We'll use one API throughout, including the awkward parts: library fallbacks, distroless verification, and an API reaching a new node before its profile does.

## Start with RuntimeDefault

On a conventional Linux container runtime, your application shares the node's kernel. Removing the shell and running as a non-root user changes the application environment; kernel operations still happen through system calls.

Seccomp filters those requests. Blocking an unnecessary syscall removes one route into kernel behaviour an attacker might otherwise reach after compromising the application. Use it alongside kernel patching, restricted credentials and capabilities, and network controls.

Enable the baseline before building anything custom. In a Deployment's Pod template:

```yaml
spec:
  template:
    spec:
      securityContext:
        seccompProfile:
          type: RuntimeDefault
```

Containers inherit this setting unless they specify their own profile. The runtime supplies the rules, so changing runtime or version can change the policy. Privileged containers run unconfined. The [Kubernetes seccomp reference](https://kubernetes.io/docs/reference/node/seccomp/) describes these selection rules.

Keep the field explicit. An omitted profile becomes `Unconfined` unless the node has seccomp defaulting enabled. An explicit `RuntimeDefault` also satisfies the seccomp requirement in the [Restricted Pod Security Standard](https://kubernetes.io/docs/concepts/security/pod-security-standards/#restricted).

## Decide whether a custom profile is worth maintaining

A runtime default accommodates many applications. A custom profile can remove operations your application never needs, but you'll need to test it when the application, dependencies, base image, or runtime changes. The profile becomes part of the application's release work.

Consider a custom profile for workloads that accept untrusted input, share nodes with other tenants, or expose components where code execution vulnerabilities are a realistic concern. You need tests that exercise more than startup and a health check. Keep `RuntimeDefault` while you build that coverage.

For hostile or mutually untrusted workloads, compare the isolation boundary itself. [gVisor](https://gvisor.dev/docs/) implements an application kernel in userspace. [Kata Containers](https://github.com/kata-containers/kata-containers) runs workloads in lightweight virtual machines. Both can be integrated through Kubernetes RuntimeClass when the corresponding runtime handler is installed.

Check their compatibility, performance, and platform requirements against your workload. A shorter syscall list alone doesn't create a separate kernel boundary.

## Record the API where it runs

The Security Profiles Operator, or SPO, records workloads and distributes profile files to nodes. The examples here target [SPO 1.1.0](https://github.com/kubernetes-sigs/security-profiles-operator/releases/tag/v1.1.0); API details were checked against upstream documentation and source on 1 October 2026. Its `SeccompProfile` resources are cluster-scoped; `ProfileRecording` resources are namespaced. Use names that won't collide across application namespaces.

Prepare a controlled Linux test cluster using the release's [installation guide](https://github.com/kubernetes-sigs/security-profiles-operator/blob/v1.1.0/installation.md). An ordinary installation requires cert-manager. BPF recording requires kernel BTF at `/sys/kernel/btf/vmlinux` and permission to run the privileged recorder and host-PID daemon.

With SPO installed in `security-profiles-operator`, enable the recorder:

```sh
kubectl -n security-profiles-operator patch spod spod --type=merge \
  -p '{"spec":{"enricher":{"enableBpfRecorder":true}}}'
```

Wait for the operator to add the BPF recorder to the DaemonSet's Pod template, then check the new rollout:

```sh
kubectl -n security-profiles-operator rollout status daemonset/spod \
  --timeout=120s
```

Confirm the recorder containers are present and ready, and inspect their startup logs on the nodes you'll use. If BTF is missing or the recorder can't start, fix that before creating the application.

The operator reconciles asynchronously. Running the rollout check immediately after the patch can report that the previous DaemonSet revision is healthy. Check that the recorder has appeared in the Pod template before trusting that result.

Create a namespace and opt it into recording:

```sh
kubectl create namespace seccomp-demo
kubectl label namespace seccomp-demo spo.x-k8s.io/enable-recording=true
```

The label enables the recording webhook for this namespace. Save the following as `recording.yaml`:

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

This records container `api` in matching Pods. `mergeStrategy: Containers` combines recordings from replicas by container name. With `disableProfileAfterRecording: true`, the generated profile stays disabled so you can review it before installation.

Apply the recording:

```sh
kubectl apply -f recording.yaml
```

Do this before creating the application Pods. The webhook instruments new Pods; it can't attach recording to a container that's already running.

Use your API's image and normal configuration. Replace the example image in this Deployment with yours, preferably pinned by digest, and include its usual arguments, environment, volumes, and probes. Keep the resource and container names so the later commands match. This template assumes an image that runs as a non-root user.

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

The new Pod matches the recording selector and keeps `RuntimeDefault` during BPF recording. Match production's architecture, libraries, runtime, and configuration. If the application fails under the baseline, investigate that failure first.

## Exercise the paths a health check misses

Build the recording exercise around integration tests, then add the operational paths they miss:

| Scenario | Behaviour to exercise |
| --- | --- |
| Startup | Configuration loading, migrations, initial DNS and TLS connections |
| Normal requests | Every supported endpoint, upload, and background job |
| Dependency failure | Timeouts, connection loss, retry, and reconnection |
| Filesystem activity | Temporary files, cache writes, cleanup, and log rotation |
| Process lifecycle | Worker creation, reload, graceful shutdown, and signals |
| Operational tasks | Backups, scheduled jobs, and maintenance commands |
| Supported environments | Every production architecture and relevant feature configuration |

Repeating one request thousands of times adds little coverage. Exercise different behaviour, including graceful termination.

Record the API, migration container, and telemetry sidecar separately. Combining their observations gives each container permissions that only another container needed.

Keep investigative commands out of the application container during recording for the same reason. A shell or debugging binary can add calls to the recording that the application doesn't need.

Use separate recordings for different architectures or incompatible environments. SPO's container merge retains an architecture list from a partial profile; merging heterogeneous recordings won't produce a portable policy.

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

Graceful termination finishes each recording, but collection is asynchronous. Don't delete the recording as soon as the Pod disappears. Wait until the expected partial profile for every recorded Pod and container appears. If a result is missing, inspect the recorder logs before continuing.

Once all partials are saved, delete the `ProfileRecording` to trigger the container merge:

```sh
kubectl -n seccomp-demo delete profilerecording seccomp-demo-api-v1
kubectl get seccompprofile seccomp-demo-api-v1-api -o yaml
```

Expect a merged profile named `seccomp-demo-api-v1-api`. If merging fails, inspect the operator's reconciliation errors before using the output. The [recording guide](https://github.com/kubernetes-sigs/security-profiles-operator/blob/v1.1.0/profiles.md#recording-based-on-ebpf-instrumentation) covers the collection workflow.

Next, save a clean resource in your repository. Keep `apiVersion`, `kind`, `metadata.name`, and `spec`; remove status and server-generated metadata. Name the reviewed version `seccomp-demo-api-v1-reviewed` and leave `spec.state: Disabled` while inspecting it. `SeccompProfile` is cluster-scoped, so it has no `metadata.namespace`.

## Review permissions and error behaviour

A shorter syscall list can still grant a wider permission.

Selecting `Localhost` replaces Kubernetes' selection of `RuntimeDefault`; it doesn't add your rules on top of the runtime profile. Compare the candidate with the actual runtime baseline before switching, including any argument restrictions it applies.

The BPF candidate allows syscall names without recording argument constraints. Suppose a baseline permits `socket` only when its first argument is `AF_INET`. An unrestricted `socket` rule also admits other families, such as `AF_VSOCK`. Preserve the argument restrictions your policy needs.

Ordinary seccomp filters can inspect numeric arguments but can't dereference a pointer to inspect a filename. For filesystem access control, an application or launcher can apply [Landlock](https://docs.kernel.org/userspace-api/landlock.html) restrictions on a supported kernel. Kubernetes' `seccompProfile` setting doesn't configure Landlock.

In glibc 2.42's [internal clone helper](https://github.com/bminor/glibc/blob/glibc-2.42/sysdeps/unix/sysv/linux/clone-internal.c#L94-L109), `ENOSYS` from `clone3` triggers a fallback to `clone`. An `EPERM` return takes a different path.

Changing the errno can therefore change application behaviour even though the syscall is denied in both cases. A library update can change that behaviour without any change to your own source code.

If your tested application needs that fallback, a targeted rule can preserve it. This fragment belongs under `spec.syscalls` for an amd64 or arm64 profile, where errno 38 is `ENOSYS`:

```yaml
- names: [clone3]
  action: SCMP_ACT_ERRNO
  errnoRet: 38
```

Remove `clone3` from any existing allow rule before adding the denial. Then verify that the caller falls back as expected and that the older syscall is permitted. Other libraries and syscalls have different conditions; returning `ENOSYS` for everything changes feature detection across the application.

The OCI JSON format supports `defaultErrnoRet`, but SPO 1.1.0 exposes per-rule `errnoRet` and has no `spec.defaultErrnoRet` field. Use the release's [SeccompProfile schema](https://github.com/kubernetes-sigs/security-profiles-operator/blob/v1.1.0/deploy/base-crds/crds/seccompprofile.yaml) when editing the resource. Check the observed errno under your runtime, which may add compatibility handling of its own.

## Install a logging version first

Before testing the enforcement profile, make an observation copy of the reviewed candidate called `observe-profile.yaml`. Retain its architectures and reviewed syscall rules, and change these fields:

```yaml
# Fragment of the copied SeccompProfile
metadata:
  name: seccomp-demo-api-v1-observe
spec:
  state: Enabled
  defaultAction: SCMP_ACT_LOG
```

Calls matching an allow rule run normally. Calls reaching `SCMP_ACT_LOG` are permitted and eligible for logging. Explicit denial rules still deny. This broadens access for the exercise, so use isolated staging with test data.

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

The enricher needs auditd output at `/var/log/audit/audit.log`, or the documented `/var/log/syslog` fallback. Check that the node's `kernel.seccomp.actions_logged` includes `log` and that audit delivery works. The [SPO logging prerequisites](https://github.com/kubernetes-sigs/security-profiles-operator/blob/v1.1.0/profiles.md#recording-based-on-audit-log) and [kernel action semantics](https://docs.kernel.org/userspace-api/seccomp_filter.html#return-values) explain those requirements.

Install the observation profile and read its node-relative path:

```sh
kubectl apply -f observe-profile.yaml
kubectl wait --for=jsonpath='{.status.status}'=Installed \
  seccompprofile/seccomp-demo-api-v1-observe --timeout=120s
kubectl get seccompprofile seccomp-demo-api-v1-observe \
  -o jsonpath='{.status.localhostProfile}{"\n"}'
```

Expect `Installed` and a path to the generated JSON file. Use the path SPO returns and check that the profile is installed on every node eligible to run the application.

Apply it to the API container while retaining the Pod default for other containers:

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

Add the container profile to `api.yaml`, preserving its other settings, and set `replicas: 1`. Apply it to create a fresh API container with the observation filter.

Start the exercise after the enricher is running, then inspect the enriched events:

```sh
kubectl -n security-profiles-operator logs \
  -l name=spod -c log-enricher --since=10m --prefix=true
```

This reads the selected daemon logs, including the application node. Look for syscall events attributed to your test workload. Every unexpected call needs an explanation before you add it to the allowlist.

Prove that the logging path works before relying on an empty result. Use the harmless probe below with a disposable observation copy named `seccomp-demo-api-v1-log-check`. Remove `getppid` from existing rules so the `SCMP_ACT_LOG` default handles it.

Install that version, read its path, and start fresh test containers before running the probe. Confirm the event arrives, then return to the observation candidate.

Empty logs can mean missing events, attribution failures, or dropped audit records. Rerun the scenario table under enforcement even if the logs are empty.

## Enforce the reviewed version and canary it

Once the logging exercise and review are complete, set `spec.state: Enabled` in `reviewed-profile.yaml`. Keep the reviewed enforcement default action, typically `SCMP_ACT_ERRNO`.

```sh
kubectl apply -f reviewed-profile.yaml
kubectl wait --for=jsonpath='{.status.status}'=Installed \
  seccompprofile/seccomp-demo-api-v1-reviewed --timeout=120s
kubectl get seccompprofile seccomp-demo-api-v1-reviewed \
  -o jsonpath='{.status.localhostProfile}{"\n"}'
```

Use this version's returned path in `api.yaml`, apply the Deployment, and start fresh containers. Rerun the complete exercise: startup, fallback paths, normal requests, graceful shutdown, and recovery after failures.

If a test fails, resist the temptation to add the syscall that appears closest to the error. `EPERM` can also come from filesystem permissions or another security control. Use the logging evidence and a controlled comparison to identify the syscall and code path before adding a permission.

Canary the profile, then roll it out. Keep the previous profile available for rollback. An updated file doesn't replace the filter in an existing process: new profile versions need new containers.

### What happens when a node joins?

A `Localhost` profile's file must exist on the node before the container starts. If the scheduler places the API there before SPO installs the file, container creation fails and Kubernetes retries. You'll commonly see `CreateContainerError`; Kubernetes won't quietly use `RuntimeDefault` instead.

You can accept that startup delay, or have node provisioning register new nodes with a `NoSchedule` startup taint. Allow the SPO daemon to tolerate the taint; remove it only after every required profile reports `Installed` for that node. A required node-affinity label maintained on the same condition is another option.

That gate is platform provisioning or controller work. SPO daemon readiness alone doesn't guarantee the files exist, and one aggregate status check won't protect nodes added later. The [installation guide](https://github.com/kubernetes-sigs/security-profiles-operator/blob/v1.1.0/installation.md#constrain-spod-scheduling) describes daemon scheduling configuration.

## Verify a distroless container

The application doesn't need a shell to have its filter inspected. An administrator can find its host PID through the node's container runtime and read `/proc/<pid>/status` there.

Alternatively, a [targeted ephemeral debug container](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/#example-debugging-using-ephemeral-containers) can inspect the application's process when the runtime supports joining its PID namespace. A Pod configured with a shared process namespace is another route.

Read the status of the application PID, not the debugger's PID. `Seccomp: 2` means that process is in filter mode. It tells you a filter is attached, but doesn't identify its rules. Use the known profile path and a behavioural test to check the rule you care about.

An ephemeral debug container has its own seccomp profile. Running a probe inside it tests that container, even when it can see the application's processes.

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

The binary calls `getppid` directly and reports its result. Mounting the ConfigMap supplies it to the test container without adding a shell or compiler to the image. Keep the binary below the ConfigMap size limit.

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

Expect a parent PID and exit status zero. Keep the image, mount, and other security settings constant for the remaining runs.

Next, create a disposable copy of the reviewed candidate named `seccomp-demo-api-v1-probe-control`. Remove `getppid` from existing rules and add this rule under `spec.syscalls`:

```yaml
- names: [getppid]
  action: SCMP_ACT_ALLOW
```

Install this version, read its path, and start fresh test containers with it. Before testing the denial, require the probe to print a parent PID and exit successfully under this control profile.

A static helper can need startup or output syscalls that the API recording missed. If you need extra permissions to make it work, keep them confined to these validation copies. They don't belong in the production policy.

Copy that working control as `seccomp-demo-api-v1-probe` and replace only its `getppid` rule:

```yaml
- names: [getppid]
  action: SCMP_ACT_ERRNO
  errnoRet: 1
```

On amd64 and arm64, errno 1 is `EPERM`. Install this version, wait for distribution, and use its returned path to start fresh API containers. Confirm that the application can start with the temporary rule, then run the same command again.

Expect `getppid: Operation not permitted` and a non-zero exit status. If the helper fails before reaching that call, diagnose its startup separately.

Because the helper worked under the control profile and only the `getppid` rule changed, this comparison tests the denial inside the application container. Keep the validation profiles out of production and run the application's full integration exercise to check compatibility.

## Ship the profile with the application

Store the reviewed profile alongside the application and tie it to the image digest you tested. Keep the architecture, runtime, node environment, and exercised scenarios with the validation evidence for that version.

For a local Linux workflow, SPO's [spoc CLI](https://github.com/kubernetes-sigs/security-profiles-operator/blob/v1.1.0/cli.md) can record a command and convert the output:

```sh
sudo spoc record -o api-candidate.yaml ./api
spoc convert -o api-candidate.json api-candidate.yaml
```

Exercise the application while it runs, then terminate it to finish the recording. The CLI adds OCI compatibility syscalls by default; review those alongside the observed calls. Test the resulting profile with the container image and Kubernetes runtime you'll deploy.

Re-record when the application, libraries, base image, runtime, architecture, or relevant node environment changes. Review the diff before accepting the new recording. Repeat the logging and enforcement tests, roll out a new profile name, and keep the previous version available for rollback.
