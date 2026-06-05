---
kind: challenge

title: "Klustered: Level Four"

description: |
  The cluster is broken again. Get the Klustered deployment healthy and serving a quote, then ship the `v2` image to unlock the victory dance.

categories:
  - kubernetes

tagz:
  - klustered

difficulty: medium

createdAt: 2026-06-02
updatedAt: 2026-06-05

cover: __static__/cover-cache-bust.png

playground:
  name: my-k8s-omni-2a60b16f

tasks:
  klustered_break:
    init: true
    machine: cplane-01
    run: |
      # 1. Create ConfigMap with init script to seed quotes table
      kubectl apply -f - <<EOF
      apiVersion: v1
      kind: ConfigMap
      metadata:
        name: postgresql
      data:
        init.sh: |
          #!/bin/bash
          set -e
          psql -v ON_ERROR_STOP=1 --username "\$POSTGRES_USER" --dbname "\$POSTGRES_DB" <<-EOSQL
              CREATE TABLE IF NOT EXISTS quotes (
                  quote VARCHAR ( 5000 ) UNIQUE NOT NULL,
                  author VARCHAR ( 500 ) NOT NULL,
                  link VARCHAR ( 512 ) NOT NULL
              );
              INSERT INTO quotes (quote, author, link)
              VALUES
                  ('May your bag be bountiful and your success be great. p.s. you''re v smart and hot', 'Stephen Augustus', 'https://twitter.com/stephenaugustus/status/1372193744078958595'),
                  ('Fight for your limits and sure enough their yours', 'Duffie''s Mom', 'https://twitter.com/mauilion/status/1373485025585340418'),
                  ('Productivity does not determine your value. You have value in just being you.', 'Katy Farmer', 'https://twitter.com/TheKaterTot/status/1370511659677089794');
          EOSQL
      EOF

      # 2. Create the database password Secret with the CORRECT value the app expects.
      kubectl apply -f - <<EOF
      apiVersion: v1
      kind: Secret
      metadata:
        name: postgres-credentials
      type: Opaque
      stringData:
        password: postgresql123
      EOF

      # 3. Deploy database Deployment.
      #    BREAK 1 (Config & env precedence): POSTGRES_PASSWORD is declared TWICE.
      #    The first entry correctly sources "postgresql123" from the Secret, but a
      #    stray literal further down redeclares it as "changeme". Duplicate env
      #    names resolve to the LAST one, so Postgres initialises with "changeme"
      #    and every app connection is rejected. The DB pod itself stays healthy
      #    (Running), so this only surfaces once the app can finally reach it.
      kubectl apply -f - <<EOF
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: database
      spec:
        replicas: 1
        selector:
          matchLabels:
            app: postgresql
        template:
          metadata:
            labels:
              app: postgresql
          spec:
            volumes:
            - name: init
              configMap:
                name: postgresql
            containers:
            - name: postgresql
              image: postgres:16
              volumeMounts:
              - mountPath: /docker-entrypoint-initdb.d
                name: init
              env:
              - name: POSTGRES_USER
                value: postgres
              - name: POSTGRES_DB
                value: klustered
              - name: POSTGRES_PASSWORD
                valueFrom:
                  secretKeyRef:
                    name: postgres-credentials
                    key: password
              - name: POSTGRES_PASSWORD
                value: changeme
              ports:
              - containerPort: 5432
              livenessProbe:
                exec:
                  command: ["/bin/sh", "-c", "exec pg_isready -U postgres -h 127.0.0.1 -p 5432"]
                initialDelaySeconds: 5
                periodSeconds: 5
              readinessProbe:
                exec:
                  command: ["/bin/sh", "-c", "exec pg_isready -U postgres -h 127.0.0.1 -p 5432"]
                initialDelaySeconds: 5
                periodSeconds: 5
      EOF

      # 4. Create postgres Service
      kubectl apply -f - <<EOF
      apiVersion: v1
      kind: Service
      metadata:
        name: postgres
      spec:
        selector:
          app: postgresql
        ports:
        - port: 5432
      EOF

      # 5. Deploy the app. Three breaks live in this one template and surface in
      #    lifecycle order as each is cleared:
      #    BREAK 2 (Resources): an infeasible CPU request keeps the pod
      #    Pending, the scheduler can never reserve 64 cores on this node.
      #    BREAK 3 (Multi-container / init): the wait-for-db init container polls
      #    "postgresql", but the Service is named "postgres", so it loops forever.
      #    BREAK 4 (Probes): the readiness probe checks a TCP socket on 8080, but
      #    the app listens on 666, so the pod never becomes Ready and the Service
      #    that selects it gets no endpoints.
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
            initContainers:
            - name: wait-for-db
              image: busybox:1.36
              command: ["sh", "-c", "until nc -z postgresql 5432; do echo waiting for db; sleep 2; done"]
            containers:
            - name: klustered
              image: ghcr.io/rawkode-academy/klustered:v1
              ports:
              - containerPort: 666
              readinessProbe:
                tcpSocket:
                  port: 8080
                initialDelaySeconds: 3
                periodSeconds: 5
              resources:
                requests:
                  cpu: "64"
                limits:
                  memory: "256Mi"
      EOF

      # 6. Service with a correct selector.
      kubectl apply -f - <<EOF
      apiVersion: v1
      kind: Service
      metadata:
        name: klustered
      spec:
        type: NodePort
        ports:
        - port: 666
          nodePort: 30000
        selector:
          app: klustered
      EOF

  verify:
    machine: cplane-01
    run: |
      set -e
      response="$(curl -fsS http://localhost:30000)"
      echo "$response" | grep -q "v2"
      echo "$response" | grep -Eq "Stephen Augustus|Duffie|Katy Farmer|May your bag|Fight for your limits|Productivity does not determine your value"
      ! echo "$response" | grep -Eqi "Failed to connect to database|error connecting|Name or service not known"
---

Welcome to **Klustered: Level Four**. The previous levels had you elbow-deep in the control plane: admission policies, disabled controllers, and node internals. This one is different. Every break lives entirely at the **workload** layer. There's nothing to fix in `/etc/kubernetes`, no policy to delete, no controller to re-enable. It's all `kubectl` against Deployments, Pods, Services, and Secrets, the day-to-day surface a developer actually owns. Think of it as CKAD batting practice.

## The Goal

Open the **App** tab in the playground UI. Right now it's blank, because nothing is reachable. You're aiming for two milestones:

1. **The app comes back to life.** Once you've repaired the workloads, the App tab shows Rawkode tapping his watch, as if to say _"any day now"_. The plumbing works, but you're still on the old version. Halfway there.
2. **The `v2` upgrade lands.** Roll the deployment forward to the `v2` image and the watch-tapping is replaced with Rawkode's victory dance. That's the win.

You'll know you're done when the dancing starts.

::simple-task
---
:tasks: tasks
:name: verify
---

#active
Waiting for the application to serve `v2` with a seeded quote...

#completed
The application is running, connected to the database, and serving `v2`. Well done!
::

## Two Ways to Play

- **Hard mode.** Just get it working and ship `v2`. No hints, no peeking.
- **Guided mode.** Work through each break step by step, gathering evidence before each fix is revealed.

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

You're on `cplane-01`. The `klustered` app Deployment, its `database` (PostgreSQL) Deployment, and both Services already exist, but `curl http://localhost:30000` gives you nothing. Several independent breaks stand between you and a working app, and they surface in **layers**: clear the one in front of you and the next reveals itself, all the way down to whether the app can actually talk to its database. The last layer in particular hides behind a pod that looks perfectly healthy, so don't trust a green `Running` at face value.

Reach for the usual tools (`kubectl get`, `describe`, `logs`, `get events`) and read the symptoms before you touch the manifests. Everything here is fixable with `kubectl edit`/`patch`/`set` on workloads; you never need to touch the control plane. Then ship `v2`. Keep the **App** tab open in another window.

Stop reading here if you want the full challenge.

---

## Guided Mode

There are **four planted breaks** standing between you and a working app, plus a **final step** to perform the `v1 -> v2` upgrade the series is named after.

Each step gives you the **symptom** first, and a question to sit with. The hint blocks are staged: where to look, what the evidence means, then how to change it. Before opening a fix block, make yourself name the exact field and value that looked wrong in your own output.

### Step 0: Get the Lay of the Land

Before changing anything, survey what exists:

```bash
kubectl get pods,svc,deploy
kubectl get events --sort-by=.lastTimestamp
curl -s http://localhost:30000
```

Read it closely before touching anything:

- Which pods are `Running`, and which aren't? For the ones that aren't, what state are they actually in, `Pending`, `Init:0/1`, `Running` but not `Ready`?
- Does the `klustered` Service have endpoints? (`kubectl get endpoints klustered`)
- What does `curl -s http://localhost:30000` give you right now?

The state of each pod is the thread you'll pull on in each step below. Some problems announce themselves loudly; at least one is hiding behind something that looks fine.

---

### Step 1: The App Pod Won't Schedule

Look at the `klustered-*` pod. `kubectl get pods` shows it `Pending`, and it never moves off that. A pod sits in `Pending` until the scheduler can find a node to place it on, so the question is why no node qualifies.

::hint-box
---
:summary: "Hint 1: Where to Look"
---

A `Pending` pod carries the scheduler's verdict with it. Read the pod's events, and then read what the pod is actually asking for:

```bash
kubectl describe pod -l app=klustered
kubectl get deploy klustered -o jsonpath='{.spec.template.spec.containers[0].resources}{"\n"}'
kubectl describe node
```

The `Events` section will tell you, in the scheduler's own words, why it couldn't place the pod. Let that reason point you at the right field in the spec.

::

::hint-box
---
:summary: "Hint 2: The Concept"
---

A container's `resources.requests` is a **scheduling input**, not just a wish. The scheduler will only place a pod on a node that can reserve the full request for it, and a single pod's request can never exceed one node's allocatable capacity. When nothing fits, the pod stays `Pending` indefinitely, no eviction, no crash, just a `FailedScheduling` event repeating.

Don't fix this from the word `Pending` alone. Use the scheduler event to identify which resource does not fit, then compare the request in the Deployment with the node's allocatable capacity. Once you can point to the impossible number, you have the field to change.

::

::hint-box
---
:summary: "Hint 3: The Fix"
---

Bring the CPU request down to something a node can actually reserve:

```bash
kubectl edit deployment klustered
# spec.template.spec.containers[0].resources.requests.cpu -> e.g. "100m"
```

Or patch it in place:

```bash
kubectl patch deployment klustered --type json \
  -p '[{"op":"replace","path":"/spec/template/spec/containers/0/resources/requests/cpu","value":"100m"}]'
```

The scheduler places the new pod immediately. It won't reach `Running` yet though, watch where it gets stuck next.

::

---

### Step 2: Stuck in Init

The pod scheduled, but `kubectl get pods` now shows it as `Init:0/1`, and it sits there. That prefix means an **init container** is still running (or stuck), and the app container hasn't been allowed to start yet.

::hint-box
---
:summary: "Hint 1: Where to Look"
---

Init containers run before the app containers, so their logs are where the story is. Address the init container by name:

```bash
kubectl logs -l app=klustered -c wait-for-db
kubectl get deploy klustered -o jsonpath='{.spec.template.spec.initContainers[0].command}{"\n"}'
```

It's clearly waiting on something. Look at exactly what host and port it's trying to reach, then check that literal name against the Services that actually exist:

```bash
kubectl get svc
```

::

::hint-box
---
:summary: "Hint 2: The Concept"
---

Init containers run **to completion, in order**, before any app container starts. If one never exits, the pod is parked at `Init:0/1` forever. This one waits for the database with `until nc -z <host> 5432; do sleep 2; done`, a reasonable gate only if `<host>` resolves and accepts a connection.

Service DNS names are **literal**. Before opening the fix, write down the hostname from the init command and the actual `metadata.name` of the Postgres Service. If those strings differ, `nc` will fail every iteration and the loop will never end.

::

::hint-box
---
:summary: "Hint 3: The Fix"
---

Point the init container at the Service that actually exists:

```bash
kubectl edit deployment klustered
# initContainers[0].command: change the hostname to the real Postgres Service name
```

With the host corrected, `nc` connects (the database has been `Running` the whole time), the init container exits `0`, and the app container finally starts. The pod moves past `Init:0/1`, but check whether it actually reaches `Ready`.

::

---

### Step 3: Running But No Endpoints

The pod is finally `Running`, yet `curl http://localhost:30000` still returns nothing. Look at the `READY` column: it says `0/1`. The process is up, but Kubernetes is holding it back from receiving traffic, and a Service only sends traffic to pods it considers ready.

::hint-box
---
:summary: "Hint 1: Where to Look"
---

Start from the empty pipe and work backwards: no traffic means no endpoints, and no endpoints means no ready pod.

```bash
kubectl get endpoints klustered
kubectl describe pod -l app=klustered
kubectl get deploy klustered -o jsonpath='{.spec.template.spec.containers[0]}{"\n"}'
```

`describe` will show you why the pod isn't ready. Then compare the related fields: which port is the readiness probe testing, which port does the Service target, and which port does the app manifest declare? Treat `containerPort` as a clue, not proof that the process is listening there.

::

::hint-box
---
:summary: "Hint 2: The Concept"
---

A pod joins its Service's endpoint list only once it is **Ready**, and readiness is decided by the readiness probe. Point that probe at a port (or socket) nothing is listening on and it fails forever: the pod never goes `Ready`, never lands in the endpoints, and the Service quietly routes to nothing. There's no error on the Service itself, just an empty endpoint list and a `curl` that hangs or refuses.

`containerPort` does not make a process bind a port; it documents the port Kubernetes objects are expected to use. In this lab, the Service and the app declaration agree, while the readiness probe is testing a different socket. The field keeping the pod out of endpoints is the probe port.

::

::hint-box
---
:summary: "Hint 3: The Fix"
---

Point the readiness probe at the port the app actually serves on:

```bash
kubectl edit deployment klustered
# readinessProbe -> set the port to the one the container serves on
```

Once the new pod passes its probe it becomes `1/1 READY` and lands in the Service endpoints:

```bash
kubectl get endpoints klustered     # now shows the pod IP
curl -s http://localhost:30000
```

This time `curl` gets a real answer from the app, but it isn't the quote you were hoping for. One layer left.

::

---

### Step 4: Reachable, But It Can't Reach Its Database

Traffic finally lands on the app, but instead of a quote you get a database error. Here's the twist: the `database` pod has been sitting there `Running` and `Ready` this whole time, `kubectl get pods` has nothing bad to say about it. So why does a healthy database reject the app?

::hint-box
---
:summary: "Hint 1: Where to Look"
---

The app is talking; let it tell you what it's hearing back. Read its logs, and read the database's:

```bash
kubectl logs deploy/klustered
kubectl logs deploy/database
```

The app's log spells out exactly how Postgres is turning it away. That phrasing is the difference between "I can't find the database" and "the database won't let me in". Decide which category you are seeing before you inspect anything else.

::

::hint-box
---
:summary: "Hint 2: The Concept"
---

The app authenticates to Postgres as a fixed user and password. Postgres sets that superuser password when it first initialises an empty data directory, from the `POSTGRES_PASSWORD` env var. If the value it was initialised with isn't the one the app sends, every connection is rejected with an authentication error, while the database itself stays perfectly healthy. That's why nothing looked wrong until now.

So inspect how that env var is built, but pause on the output before opening the fix:

```bash
kubectl get deploy database -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}{" = "}{.value}{.valueFrom.secretKeyRef.key}{"\n"}{end}'
kubectl get secret postgres-credentials -o jsonpath='{.data.password}' | base64 -d; echo
```

Answer these from what you see:

- How many `POSTGRES_PASSWORD` entries are present?
- Which entry comes from the Secret?
- Which entry is a plain literal?
- Which value will the container actually receive?

Kubernetes accepts the duplicate-name list, and duplicate names are easy to miss because the pod still becomes healthy. In this manifest, list order is the trap.

::

::hint-box
---
:summary: "Hint 3: The Fix"
---

Remove the duplicate literal so the Secret-sourced value is the only one left:

```bash
kubectl edit deployment database
# delete the second `- name: POSTGRES_PASSWORD` / `value: ...` entry,
# leaving the one that reads from secretKeyRef
```

Editing the env isn't enough on its own, though. Postgres only reads `POSTGRES_PASSWORD` when it initialises a fresh data directory, so the running instance is still carrying the old password. This database has no persistent volume, so the cleanest reset is to let it re-initialise from scratch:

```bash
kubectl rollout restart deployment database     # or: kubectl delete pod -l app=postgresql
```

The new pod initialises with the Secret's password and re-seeds the `quotes` table. Give it a few seconds, then:

```bash
curl -s http://localhost:30000
```

Flip to the **App** tab. You should see Rawkode tapping his watch, with a quote underneath. The app is alive, just running the wrong version. One step to the dance floor.

::

---

### Step 5: Final Step (Ship `v2`)

This is the goal of the level. The cluster is healthy, the app is serving a quote, Rawkode is tapping his watch on the **App** tab. Time to roll the deployment forward and unlock the dance.

::hint-box
---
:summary: "Hint 1: The Concept"
---

A Deployment's pod template is the source of truth for what runs. Change the image tag and Kubernetes performs a rolling update: it creates a new ReplicaSet, scales it up, scales the old one down, and keeps the old pods serving until the new ones are `Ready`. If a rollout ever seems to hang, `kubectl rollout status` tells you why, and `kubectl rollout undo` walks it back.

Watch the new pod become `Ready` before the old one goes away, that's readiness gating the rollout, the same mechanism you fixed in Step 3. It's worth remembering that a bad pod template can stall a rollout: an infeasible resource request like Step 1, or a failing readiness probe like Step 3, leaves the old pods serving while the new ReplicaSet never goes `Ready`.

::

::hint-box
---
:summary: "Hint 2: The Rollout"
---

```bash
kubectl set image deployment/klustered klustered=ghcr.io/rawkode-academy/klustered:v2
kubectl rollout status deployment/klustered
```

Or `kubectl edit deployment klustered` and change `:v1` to `:v2`.

Refresh the **App** tab. Dance party.

::
