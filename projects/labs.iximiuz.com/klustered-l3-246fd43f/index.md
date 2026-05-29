---
kind: challenge

title: "Klustered: Level Three"

description: |
  Make sure the Klustered deployment is running and that you can browse to it and see the counter increase with each refresh.

categories:
  - kubernetes

tagz:
  - klustered

difficulty: hard

createdAt: 2026-05-29
updatedAt: 2026-05-29

cover: __static__/cover.png

playground:
  name: my-k8s-omni-2a60b16f

tasks:
  klustered_break:
    init: true
    machine: cplane-01
    run: |
      # 1. Create PV with root-owned data
      mkdir -p /var/data/klustered
      echo "Rawkode Academy - Klustered: Level 3" > /var/data/klustered/index.html
      chown -R root:root /var/data/klustered
      chmod 700 /var/data/klustered

      kubectl apply -f - <<EOF
      apiVersion: v1
      kind: PersistentVolume
      metadata:
        name: app-data
      spec:
        capacity:
          storage: 1Gi
        accessModes: [ReadWriteOnce]
        hostPath:
          path: /var/data/klustered
      ---
      apiVersion: v1
      kind: PersistentVolumeClaim
      metadata:
        name: app-data
      spec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 1Gi
      EOF

      # 2. Build custom Go web server with random port baked into binary
      WORKDIR=$(mktemp -d)
      PORT=$((RANDOM % 50000 + 10000))
      IMAGE_TAG="ttl.sh/klustered-l3-$(head -c 8 /dev/urandom | xxd -p):2h"

      cat > ${WORKDIR}/main.go << GOEOF
      package main

      import (
          "fmt"
          "net/http"
          "os"
          "strconv"
          "strings"
      )

      func main() {
          http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
              data, err := os.ReadFile("/data/index.html")
              if err != nil {
                  http.Error(w, "Failed to read data", 500)
                  return
              }

              count := 0
              if countBytes, err := os.ReadFile("/data/counter"); err == nil {
                  count, _ = strconv.Atoi(strings.TrimSpace(string(countBytes)))
              }
              count++
              os.WriteFile("/data/counter", []byte(strconv.Itoa(count)), 0644)

              fmt.Fprintf(w, "%s\nVisits: %d", strings.TrimSpace(string(data)), count)
          })
          http.ListenAndServe(":${PORT}", nil)
      }
      GOEOF

      cat > ${WORKDIR}/Dockerfile << 'DEOF'
      FROM golang:1.23-alpine AS build
      WORKDIR /src
      COPY main.go .
      RUN CGO_ENABLED=0 go build -o /server main.go

      FROM scratch
      COPY --from=build /server /server
      ENTRYPOINT ["/server"]
      DEOF

      # Ensure a container build tool is available (node uses containerd, install nerdctl if needed)
      if ! command -v nerdctl &>/dev/null && ! command -v docker &>/dev/null && ! command -v podman &>/dev/null; then
        NERDCTL_VERSION="2.0.2"
        curl -sSL "https://github.com/containerd/nerdctl/releases/download/v${NERDCTL_VERSION}/nerdctl-${NERDCTL_VERSION}-linux-amd64.tar.gz" \
          | tar -xz -C /usr/local/bin nerdctl
      fi

      # nerdctl requires buildkitd; install and start it if missing
      if command -v nerdctl &>/dev/null && ! pgrep -x buildkitd > /dev/null; then
        if ! command -v buildkitd &>/dev/null; then
          BUILDKIT_VERSION="0.17.3"
          curl -sSL "https://github.com/moby/buildkit/releases/download/v${BUILDKIT_VERSION}/buildkit-v${BUILDKIT_VERSION}.linux-amd64.tar.gz" \
            | tar -xz -C /usr/local/bin --strip-components=1 bin/buildkitd bin/buildctl
        fi
        buildkitd &
        sleep 3
      fi

      BUILDER=$(command -v nerdctl || command -v docker || command -v podman)

      # Build and push to ttl.sh (2 hour TTL)
      ${BUILDER} build -t ${IMAGE_TAG} ${WORKDIR}
      ${BUILDER} push ${IMAGE_TAG}

      # Clean up ALL build artifacts and buildkitd
      rm -rf ${WORKDIR}
      pkill -x buildkitd 2>/dev/null || true

      # 3. Deploy app as non-root (UID 1000) so it can't read the root:root 700 data (BEFORE MAP is applied)
      kubectl apply -f - <<EOF
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: klustered
      spec:
        replicas: 1
        selector:
          matchLabels:
            app: klustered
        template:
          metadata:
            labels:
              app: klustered
          spec:
            containers:
            - name: klustered
              image: ${IMAGE_TAG}
              securityContext:
                runAsUser: 1000
                runAsGroup: 1000
              ports:
              - containerPort: 666
              volumeMounts:
              - name: data
                mountPath: /data
              resources:
                requests:
                  memory: "128Mi"
                limits:
                  memory: "256Mi"
            volumes:
            - name: data
              persistentVolumeClaim:
                claimName: app-data
      ---
      apiVersion: v1
      kind: Service
      metadata:
        name: klustered
      spec:
        type: NodePort
        ports:
        - port: 666
          targetPort: 666
          nodePort: 30000
        selector:
          app: klustered
      EOF

      # 4. Apply MutatingAdmissionPolicy (GA / v1 in Kubernetes 1.36)
      kubectl apply -f - <<EOF
      apiVersion: admissionregistration.k8s.io/v1
      kind: MutatingAdmissionPolicy
      metadata:
        name: resource-enforcer
      spec:
        reinvocationPolicy: Never
        matchConstraints:
          resourceRules:
          - apiGroups: [""]
            apiVersions: ["v1"]
            operations: ["CREATE"]
            resources: ["pods"]
        mutations:
        - patchType: "ApplyConfiguration"
          applyConfiguration:
            expression: |
              Object{
                spec: Object.spec{
                  containers: object.spec.containers.map(c, Object.spec.containers{
                    name: c.name,
                    resources: Object.spec.containers.resources{
                      limits: Object.spec.containers.resources.limits{
                        memory: "1Mi"
                      }
                    }
                  })
                }
              }
      ---
      apiVersion: admissionregistration.k8s.io/v1
      kind: MutatingAdmissionPolicyBinding
      metadata:
        name: resource-enforcer-binding
      spec:
        policyName: resource-enforcer
        matchResources:
          namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: default
      EOF

      # 5. Delete existing pods to force recreation through MAP
      sleep 2
      kubectl delete pods -l app=klustered

  verify:
    machine: cplane-01
    run: |
      curl -s http://localhost:30000 | grep -q "Visits"
---

Welcome to **Klustered: Level Three**. The app is deployed, the cluster looks healthy at a glance, and yet nothing reaches you on port `30000`. This level stacks several traps that only reveal themselves one at a time, each surfacing once you clear the one before it. Peel them back in order and the app comes alive, counting every visit.

## The Goal

Open the **App** tab in the playground UI. Right now it's blank. You're done when the page loads and shows a visit counter that **increases by one every time you refresh**:

```
Rawkode Academy - Klustered: Level 3
Visits: 1
```

Refresh, and `Visits` should climb. That counter is backed by a persistent volume, so getting it to increment proves the whole chain is working: pod running, traffic routed, and the app able to read and write its data.

::simple-task
---
:tasks: tasks
:name: verify
---

#active
Waiting for the application to be accessible on port 30000...

#completed
The application is running and accessible! Well done!
::

## Two Ways to Play

- **Hard mode.** Just get the counter climbing. No hints, no peeking.
- **Guided mode.** Work through each trap step by step, with the concept behind it explained before the fix.

Pick your path below.

---

## Getting Started

You'll be working from `cplane-01`. The admin kubeconfig is only readable by root, so the very first thing to do is switch users:

```bash
sudo su
```

Quick sanity check (you should see a node listed):

```bash
kubectl get nodes
```

If you get a permission or auth error, double-check you actually became root before running `kubectl`.

---

## Hard Mode

You're on `cplane-01`. The `klustered` Deployment and its `NodePort` Service already exist, but `curl http://localhost:30000` gives you nothing. There are **three independent traps** between you and a climbing counter, and they surface in layers: the pod won't stay up, then traffic won't reach it, then the app can't read its own data.

Reach for the usual tools (`kubectl get`, `describe`, `logs`, `get events`), and don't trust the Deployment template alone, what's been admitted to the cluster may not match what you wrote. Keep the **App** tab open in another window.

Stop reading here if you want the full challenge.

---

## Guided Mode

There are **three planted bugs** standing between you and a working counter. They surface in this order:

1. The pod is admitted, then immediately killed.
2. The pod runs, but nothing reaches it on `30000`.
3. Traffic reaches the app, but the app can't read its data.

For each step, try the **observation prompts** first. Only open the hint blocks when you're stuck. They spoil the answer in stages: nudge, then concept, then fix.

### Step 0: Get the Lay of the Land

Before changing anything, look at what exists.

```bash
kubectl get pods,svc,deploy
kubectl get events --sort-by=.lastTimestamp
curl -s http://localhost:30000
```

**What to notice:**

- Is the `klustered` pod `Running`, or is it cycling through `Error` / `CrashLoopBackOff` / `OOMKilled`?
- Does the `klustered` Service have endpoints? (`kubectl get endpoints klustered`)
- Does `curl http://localhost:30000` return anything at all?

The pod won't be healthy yet, and that's the first thread to pull.

---

### Step 1: The Pod That Starves on Startup

Run `kubectl get pods`. The `klustered` pod keeps dying, `kubectl describe pod -l app=klustered` will show it being `OOMKilled` almost as soon as it starts. That's strange: the Deployment asks for a sensible `256Mi` limit, which is plenty for a tiny Go binary.

```bash
kubectl describe pod -l app=klustered
kubectl get pod -l app=klustered -o jsonpath='{.items[0].spec.containers[0].resources}{"\n"}'
kubectl get deploy klustered -o jsonpath='{.spec.template.spec.containers[0].resources}{"\n"}'
```

**What to notice:** the live pod's memory limit and the Deployment template's memory limit do **not** match. Something rewrote the pod on its way into the cluster.

::hint-box
---
:summary: "Hint 1: Where to Look"
---

The Deployment template says `256Mi`, but the running pod's limit is `1Mi`, far too little for the process to start. Nobody edited the Deployment, so the change happened **at admission time**, as the pod was created.

Kubernetes has admission resources that can rewrite objects before they're stored. Go looking for one that mutates pods:

```bash
kubectl get mutatingadmissionpolicies,mutatingadmissionpolicybindings
```

::

::hint-box
---
:summary: "Hint 2: The Concept"
---

A [`MutatingAdmissionPolicy`](https://kubernetes.io/docs/reference/access-authn-authz/mutating-admission-policy/) lets the API server rewrite incoming objects using CEL, no webhook server required. This cluster has one called `resource-enforcer` bound to the `default` namespace. On every pod `CREATE` it overwrites each container's resources so the memory limit becomes `1Mi`.

That's why the loop never ends: the ReplicaSet creates a replacement pod, the policy crushes its memory to `1Mi`, the kernel `OOMKills` it, and the ReplicaSet tries again. The Deployment template is innocent; the mutation happens to the pod, not the template.

::

::hint-box
---
:summary: "Hint 3: The Fix"
---

Remove the binding first, then the policy:

```bash
kubectl delete mutatingadmissionpolicybinding resource-enforcer-binding
kubectl delete mutatingadmissionpolicy resource-enforcer
```

Existing pods were already mutated, so delete the current one and let the ReplicaSet create a fresh, unmutated replacement:

```bash
kubectl delete pod -l app=klustered
kubectl get pod -l app=klustered -o jsonpath='{.items[0].spec.containers[0].resources}{"\n"}'
```

The new pod should keep its `256Mi` limit and finally reach `Running`. Now try `curl http://localhost:30000` again, it still won't answer. On to the next layer.

::

---

### Step 2: A Service Knocking on the Wrong Door

The pod is `Running` and the Service has an endpoint, but `curl http://localhost:30000` is refused. Traffic is being routed to the pod, it's just arriving at a port where nothing is listening.

```bash
kubectl get svc klustered -o yaml
kubectl get endpoints klustered
curl -v http://localhost:30000     # "Connection refused" = reached the pod, no listener on that port
```

**What to notice:** the Service forwards to `targetPort: 666` (matching the Deployment's `containerPort: 666`). But `containerPort` is just a label, it does not force the process to bind `666`. So which port is the binary **actually** listening on? It was built `FROM scratch`, so there is no shell, no `ss`, no `netstat` inside the container. You have to discover the bind from the outside. This is the real skill of the step: **finding a rogue port binding when you can't ask the process directly.**

::hint-box
---
:summary: "Hint 1: The Concept (containerPort is a lie)"
---

A Service has three port fields, and conflating them is the whole trap:

- `port`: the port the Service itself is reachable on.
- `targetPort`: the port **on the pod** that traffic is forwarded to.
- `nodePort`: the port exposed on every node (for `type: NodePort`).

`containerPort` in the Deployment is **documentation only**. The kubelet does not enforce it, and the process is free to bind any port it likes. Here the binary listens on a random high port, while `containerPort` and `targetPort` were both left at `666`, so kube-proxy faithfully forwards `30000 -> pod:666`, a closed door. Nothing in `kubectl get` or `describe` will tell you the real port; you have to inspect the live socket.

::

::hint-box
---
:summary: "Hint 2: The Quick Way (ephemeral debug container)"
---

You can't `exec` into a `scratch` image, but you can attach an [ephemeral debug container](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/#ephemeral-container) that **shares the target's network namespace**, then run socket tools from there:

```bash
POD=$(kubectl get pod -l app=klustered -o jsonpath='{.items[0].metadata.name}')
kubectl debug -it ${POD} --image=nicolaka/netshoot --target=klustered -- ss -tlnp
```

`ss` shows both IPv4 and IPv6 listeners in one view, so the `LISTEN` row reveals the real port (it won't be `666`). If the debug image can't be pulled, fall back to the node-side procfs method in the next hint, which needs no tools at all.

::

::hint-box
---
:summary: "Hint 3: The Deep Way (procfs) and the tcp6 trap"
---

Every listening socket is visible from the **node** in procfs, no tools required in the container. First find the container's host PID, then read its per-namespace socket tables:

```bash
CID=$(crictl ps --name klustered -q)
PID=$(crictl inspect "$CID" | jq -r .info.pid)
awk '$4=="0A"{print $2}' /proc/$PID/net/tcp     # state 0A = LISTEN; HEXIP:HEXPORT
```

Run that and you'll likely get **nothing**. That is the trap, and the most important lesson in this step:

> A Go server started with `http.ListenAndServe(":PORT", ...)` binds the **IPv6 wildcard `[::]`**, not `0.0.0.0`. The socket is `AF_INET6`, so it appears in **`/proc/$PID/net/tcp6`**, not `/proc/$PID/net/tcp`. Look at only `tcp` and you'll wrongly conclude nothing is listening.

Always check **both** tables (and `udp`/`udp6` for UDP services). This reads both and decodes the hex port to decimal:

```bash
for proto in tcp tcp6; do
  echo "== $proto =="
  awk '$4=="0A"{split($2,a,":"); print a[2]}' /proc/$PID/net/$proto \
    | while read -r hex; do printf '  listening on %d\n' "0x$hex"; done
done
```

`tcp` prints nothing; `tcp6` prints the real port. Decoding by hand: in `00000000000000000000000000000000:1F90`, the `[::]` address is all zeros and `1F90` hex = `8080`. That decimal value is your `targetPort`.

::

::hint-box
---
:summary: "Hint 4: The Fix"
---

Point the Service's `targetPort` at the port you discovered (replace `<PORT>`):

```bash
kubectl patch svc klustered --type merge \
  -p '{"spec":{"ports":[{"port":666,"targetPort":<PORT>,"nodePort":30000}]}}'
```

Or `kubectl edit svc klustered` and set `spec.ports[0].targetPort` by hand. Confirm traffic now reaches the app:

```bash
curl -v http://localhost:30000
```

This time you'll get a reply from the app, but it isn't the page you wanted. One layer left.

::

---

### Step 3: The App Can't Read Its Own Data

Traffic now reaches the app, but instead of the page and counter you get an error:

```bash
curl -s http://localhost:30000
# Failed to read data
```

The data lives on a `PersistentVolume` backed by a `hostPath`, and the file is definitely there. The question to ask is: **what identity is the process running as, and does that identity have permission to read the file?**

::hint-box
---
:summary: "Hint 1: Where to Look"
---

Two things decide whether a read succeeds: the UID the process runs as, and the ownership/mode of the file. Look at both.

The identity comes from the container's `securityContext`:

```bash
kubectl get deploy klustered -o jsonpath='{.spec.template.spec.containers[0].securityContext}{"\n"}'
# {"runAsGroup":1000,"runAsUser":1000}
```

The ownership comes from the backing `hostPath` on the node:

```bash
ls -ln /var/data/klustered
# drwx------ ... 0 0 ... index.html   (owner UID 0, mode 700)
```

A process running as UID `1000` against a directory owned by UID `0` with mode `700`. That can't end well.

::

::hint-box
---
:summary: "Hint 2: The Concept"
---

`runAsUser: 1000` makes the container process run as UID `1000`. Unlike user namespaces, there is **no UID remapping**: a `hostPath` volume keeps whatever ownership it has on the node's disk, and the kernel checks the container's UID against those on-disk owners directly.

The data dir is `root:root` with mode `700` (owner-only `rwx`). UID `1000` is not the owner and not in the group, so it can't even traverse the directory, let alone read `index.html`. The app returns "Failed to read data".

This is one of the most common real-world Kubernetes failures: an image that assumed root, dropped onto a cluster that forces non-root (PodSecurity `restricted`, OpenShift's arbitrary UIDs, or a hardened `securityContext`), suddenly unable to touch its own volume.

::

::hint-box
---
:summary: "Hint 3: The Fix (the right way)"
---

The production-correct fix is to reconcile the volume's ownership with the UID the app runs as, using an **init container that runs as root** and `chown`s the data before the app starts:

```bash
kubectl patch deployment klustered --type json -p '[
  {"op":"add","path":"/spec/template/spec/initContainers","value":[
    {"name":"fix-perms","image":"busybox:1.36",
     "securityContext":{"runAsUser":0},
     "command":["sh","-c","chown -R 1000:1000 /data"],
     "volumeMounts":[{"name":"data","mountPath":"/data"}]}
  ]}
]'
```

The init container is root (UID `0`), so it can chown the node's `hostPath`; the main container stays non-root and now owns its data. The Deployment rolls a new pod; once it's `Running`:

```bash
curl -s http://localhost:30000
```

You should now see the page and `Visits: 1`.

::

::hint-box
---
:summary: "Hint 4: Other Fixes (and a trap)"
---

Three more ways out, each teaching something:

- **`fsGroup` looks right but silently fails here.** Adding `spec.template.spec.securityContext.fsGroup: 1000` tells the kubelet to fix volume group ownership, but **that mechanism does not apply to `hostPath` volumes** (only to volume types that support ownership management, like most CSI/`emptyDir` volumes). The read still fails. A great reminder that `fsGroup` is not a universal fix.
- **Run as root** (`kubectl patch deployment klustered --type json -p '[{"op":"remove","path":"/spec/template/spec/containers/0/securityContext"}]'`). Works, because UID `0` owns the data, but it throws away the non-root posture. Quick, and usually the wrong call.
- **Loosen perms on the node** (`chmod -R 755 /var/data/klustered`). Works, but only when you control the node, which in the real world you usually don't.

The init-container `chown` in Hint 3 is the one that keeps the app non-root *and* doesn't depend on node access, which is why it's the production answer.

::

---

### Step 4: Watch the Counter Climb

Everything's healthy: the pod runs, the Service routes to the right port, and the app can read and write its data. Flip to the **App** tab and refresh a few times.

```bash
curl -s http://localhost:30000
curl -s http://localhost:30000
```

Each request increments the counter and persists it to the volume, so `Visits` should climb `1, 2, 3, ...` with every refresh. When the number goes up, you've won.
