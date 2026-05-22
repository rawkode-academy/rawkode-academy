---
kind: challenge

title: "Klustered: Level One"

description: |
  The cluster is broken. Fix the plumbing to bring the app to life (you'll know it's working when Rawkode taps his watch at you), then ship the `v2` image to unlock his victory dance.

categories:
  - kubernetes

tagz:
  - klustered

difficulty: easy

createdAt: 2026-05-15
updatedAt: 2026-05-15

cover: __static__/cover.png

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

      # 2. Deploy database Deployment
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
            schedulingGates:
            - name: example.com/quota-check
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
                value: postgresql123
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

      # 3. Create postgres Service
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

      # 2. Deploy app Deployment with dnsPolicy: Default
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
            dnsPolicy: Default
            containers:
            - name: klustered
              image: ghcr.io/rawkode-academy/klustered:v1
              ports:
              - containerPort: 666
              resources:
                limits:
                  memory: "128Mi"
                  cpu: "500m"
      EOF

      # 3. Service with typo in selector
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
          app: klustred
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

Welcome to **Klustered: Level One**. Someone left this cluster in a _thoroughly_ broken state, and you've been handed the keys. Your job: fix it.

## The Goal

Open the **App** tab in the playground UI. Right now it's blank, because nothing is reachable. You're aiming for two milestones:

1. **The app comes back to life.** Once you've patched up the cluster, the App tab will show Rawkode tapping his watch, as if to say _"any day now"_. The plumbing works, but you're still on the old version. Halfway there.
2. **The `v2` upgrade lands.** Roll the deployment forward to the `v2` image and the watch-tapping is replaced with Rawkode's victory dance. That's the win.

Visually, you'll know you're done when the dancing starts.

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

- **Hard mode.** Just get it working. No hints, no peeking.
- **Guided mode.** Work through it step by step, with each bug framed as a learning opportunity.

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

You're on `cplane-01`. The cluster has several distinct problems: some obvious, some sneaky. Reach for whatever `kubectl` you'd use in the wild (`get`, `describe`, `logs`, `events`, `explain`) and keep the **App** tab open in another window so you can see the watch-tap appear when you get close.

Stop reading here if you want the full challenge.

---

## Guided Mode

There are **three planted bugs** standing between you and a working cluster, plus a **final step** to actually perform the `v1 -> v2` upgrade that the challenge is named after. Each bug teaches something different about Kubernetes. Work through them in order, or jump around if you spot something faster.

For each step, try the **observation prompts** first. Only open the hint blocks when you're stuck. They spoil the answer in stages: nudge, then concept, then fix.

### Step 0: Get the Lay of the Land

Before changing anything, look at what exists.

```bash
kubectl get pods,svc,deploy
kubectl get events --sort-by=.lastTimestamp
```

**What to notice:**

- Which pods are `Running`? Which are not, and what state are they stuck in?
- Does the `klustered` service have endpoints? (`kubectl get endpoints klustered`)
- Can you reach the app at all? (`curl -s http://localhost:30000`)
- And out of curiosity, what does the **App** tab show right now? (Spoiler: not Rawkode, not yet.)

You should see at least one pod that never becomes `Running`, and a service with no endpoints. Those are two separate problems. There are more once you start digging.

---

### Step 1: The Database Pod That Won't Schedule

Run `kubectl get pods`. The `database-*` pod is stuck in `Pending`. Normally that means insufficient resources or a taint, but `kubectl describe pod` will tell you the real reason.

::hint-box
---
:summary: "Hint 1: Where to Look"
---

Look at the `Status` and `Conditions` on the pod, and the `spec` of the deployment. The pod isn't waiting for a node. The scheduler has been told _not to try yet_.

::

::hint-box
---
:summary: "Hint 2: The Concept"
---

Kubernetes 1.27+ introduced [**scheduling gates**](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-scheduling-readiness/). A pod can declare `spec.schedulingGates`, and the scheduler will refuse to place it until **every gate is removed**. Gates are normally removed by an external controller (quota system, admission webhook, etc.) once its precondition is satisfied.

This deployment declares a gate (`example.com/quota-check`) but no controller exists to remove it. The pod is gated forever.

::

::hint-box
---
:summary: "Hint 3: The Fix"
---

Edit the deployment and remove the `schedulingGates` block from the pod template:

```bash
kubectl edit deployment database
# delete the schedulingGates: ... lines under spec.template.spec
```

The pod should immediately schedule and start.

::

---

### Step 2: The Service Points to Nobody

`curl http://localhost:30000` returns nothing. Check the wiring:

```bash
kubectl get svc klustered
kubectl get endpoints klustered
```

The Service exists, the `klustered` pod is `Running`, but `endpoints` shows `<none>`. A Service with no endpoints is a Service that routes traffic to thin air.

::hint-box
---
:summary: "Hint 1: Where to Look"
---

A Service finds its pods by **label selector**. Look at the labels on the pod (`kubectl get pod -l app=klustered`) and the selector on the Service (`kubectl get svc klustered -o yaml`). Compare them character by character.

::

::hint-box
---
:summary: "Hint 2: The Concept"
---

Service selectors are **literal string matches**. There's no fuzzy matching, no warning if no pod matches. You just get an empty Endpoints list and a Service that silently routes to nothing. This is one of the most common "everything looks right" bugs in Kubernetes, and a great reminder to always check `kubectl get endpoints` when a Service "doesn't work".

::

::hint-box
---
:summary: "Hint 3: The Fix"
---

The Service selector is `app: klustred`, missing an `e`. Fix it:

```bash
kubectl edit svc klustered
# change selector: app: klustred  ->  app: klustered
```

`kubectl get endpoints klustered` should now show the pod IP. Try `curl http://localhost:30000` again. It probably reaches the pod now, but the response isn't what you'd hope for. Onward.

::

---

### Step 3: The App Can Resolve Nothing

The Service is wired up, the pod is running, but the page either errors out or hangs. That means traffic _is_ getting to the app, and the app itself is unhappy. Time to look at the logs:

```bash
kubectl logs deploy/klustered
```

You'll likely see DNS resolution failures for `postgres`. But `postgres` is a perfectly valid Service in this namespace, and `nslookup postgres` from another pod works fine. So why can't _this_ pod resolve it?

::hint-box
---
:summary: "Hint 1: Where to Look"
---

Compare the `klustered` deployment's pod spec to the `database` deployment's pod spec. There's a field on one that isn't on the other, and it changes how the pod's `/etc/resolv.conf` gets built.

::

::hint-box
---
:summary: "Hint 2: The Concept"
---

[`dnsPolicy`](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/#pod-s-dns-policy) controls which resolver a pod inherits:

- `ClusterFirst` (the default): pods use CoreDNS, so Service names like `postgres` resolve.
- `Default`: pods inherit the **node's** `/etc/resolv.conf`, which knows nothing about cluster Services.

The klustered deployment has `dnsPolicy: Default`, so its pod skips CoreDNS entirely and can't find `postgres`.

::

::hint-box
---
:summary: "Hint 3: The Fix"
---

Remove the `dnsPolicy: Default` line from the deployment (the default is `ClusterFirst`), or set it explicitly:

```bash
kubectl edit deployment klustered
# remove the dnsPolicy: Default line, or change to ClusterFirst
```

Flip over to the **App** tab. You should see Rawkode tapping his watch. The app is alive, just running the wrong version. One more bug between you and the dance floor.

::

---

### Step 4: Final Step (Ship `v2`)

This is the actual goal of the level. Everything up to now was just clearing rubble so you could do this safely. The cluster is healthy, the app is serving, Rawkode is tapping his watch on the **App** tab. Time to roll the deployment forward and unlock the dance.

::hint-box
---
:summary: "Hint 1: The Concept"
---

A Deployment's pod template is the source of truth for what gets run. Change the image tag in the template and Kubernetes performs a rolling update: it spins up a new ReplicaSet, scales it up, scales the old one down, and (if anything goes wrong) you can `kubectl rollout undo` your way back.

You can do this two ways: edit the manifest directly with `kubectl edit`, or use the imperative shortcut `kubectl set image`. Both produce the same result. The former is closer to GitOps-style workflows; the latter is faster at the keyboard.

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
