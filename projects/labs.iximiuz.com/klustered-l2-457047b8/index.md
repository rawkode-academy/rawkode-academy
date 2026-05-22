---
kind: challenge

title: "Klustered: Level Two"

description: |
  Make sure the Klustered deployment is running the `v2` tag and that you can visit the application to see a lovely quote and a video of me dancing.

categories:
  - kubernetes

tagz:
  - klustered

difficulty: medium

createdAt: 2026-05-22
updatedAt: 2026-05-22

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

      # 4. Deploy app (before VAP is applied so it gets created)
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
              image: ghcr.io/rawkode-academy/klustered:v1
              ports:
              - containerPort: 666
              resources:
                requests:
                  memory: "128Mi"
                  cpu: "100m"
                limits:
                  memory: "256Mi"
                  cpu: "500m"
      ---
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

      sleep 15

      # 5. In-place resize to infeasible values
      POD_NAME=$(kubectl get pod -l app=klustered -o jsonpath='{.items[0].metadata.name}')
      kubectl patch pod ${POD_NAME} \
        --subresource resize \
        -p '{"spec":{"containers":[{"name":"klustered","resources":{"requests":{"memory":"32Gi"},"limits":{"memory":"64Gi"}}}]}}'

      # 6. Disable the ReplicaSet controller in kube-controller-manager
      CONTROLLER_MANAGER_MANIFEST="/etc/kubernetes/manifests/kube-controller-manager.yaml"
      if [ ! -f "$CONTROLLER_MANAGER_MANIFEST" ]; then
        CONTROLLER_MANAGER_MANIFEST="/etc/kubernetes/manifests/kube-controller-manager.yml"
      fi

      if grep -q -- "--controllers=" "$CONTROLLER_MANAGER_MANIFEST"; then
        sed -i.bak 's#^\([[:space:]]*- --controllers=\).*#\1*,-replicaset-controller#' "$CONTROLLER_MANAGER_MANIFEST"
      else
        sed -i.bak '/^[[:space:]]*- kube-controller-manager$/a\    - --controllers=*,-replicaset-controller' "$CONTROLLER_MANAGER_MANIFEST"
      fi

      sleep 15

      # 7. Apply ValidatingAdmissionPolicy that locks out new Pod creation
      kubectl apply -f - <<EOF
      apiVersion: admissionregistration.k8s.io/v1
      kind: ValidatingAdmissionPolicy
      metadata:
        name: namespace-guard
      spec:
        failurePolicy: Fail
        matchConstraints:
          resourceRules:
          - apiGroups: [""]
            apiVersions: ["v1"]
            operations: ["CREATE"]
            resources: ["pods"]
        validations:
        - expression: "object.metadata.name.startsWith('kube-')"
          message: "Only system pods (kube-*) may be created. Contact platform team."
      ---
      apiVersion: admissionregistration.k8s.io/v1
      kind: ValidatingAdmissionPolicyBinding
      metadata:
        name: namespace-guard-binding
      spec:
        policyName: namespace-guard
        validationActions: [Deny]
        matchResources:
          namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: default
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

Welcome to **Klustered: Level Two**. This time the app is closer to alive, but the cluster has been booby-trapped so a normal rollout will not behave normally.

## The Goal

Open the **App** tab in the playground UI. You need the Klustered deployment running the `v2` image. When everything is fixed, the app will serve a lovely quote and Rawkode's victory dance.

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

- **Hard Mode.** Treat it like a production rollout gone weird. Try to ship `v2`, read the errors, and fix only what blocks you.
- **Guided Mode.** Work through the traps one at a time. This level is about comparing desired state with live state and understanding what really happens during a Deployment rollout.

---

## Getting Started

You'll be working from `cplane-01`. The admin kubeconfig is only readable by root, so switch users first:

```bash
sudo su
```

Quick sanity check:

```bash
kubectl get nodes
```

If `kubectl` returns a permission or auth error, double-check that you became root before continuing.

---

## Hard Mode

You're on `cplane-01`. The Service already points at the app, but a plain `v1 -> v2` rollout is blocked by several planted cluster problems. Use the normal tools: `kubectl get`, `kubectl describe`, `kubectl rollout status`, `kubectl get events`, and the **App** tab.

Stop reading here if you want the full challenge.

---

## Guided Mode

There are **three planted bugs** between you and a clean rollout, plus the final `v2` upgrade. The first bug is hidden in the state of the existing pod. The next two only really show themselves during the rollout.

For each step, try the observation prompts first. Only open the hint blocks when you're stuck. They spoil the answer in stages: nudge, then concept, then fix.

### Step 0: Get the Lay of the Land

Before changing anything, look at what exists.

```bash
kubectl get deployments,pods,services,endpoints
kubectl get events --sort-by=.lastTimestamp
curl -s http://localhost:30000
```

**What to Notice:**

- Is the `klustered` pod running?
- Does the `klustered` Service have endpoints? (`kubectl get endpoints klustered`)
- Is the `database` pod running, and does the `postgres` Service have endpoints?
- Which image is the deployment using?
- If the app responds, does it show a quote, or does it report a database connection error?

---

### Step 1: What is a Subresource?

The existing pod was created by a Deployment, so it should look like the Deployment's pod template. Before changing the image, check whether the controller's desired state and the live pod's current state still line up.

Start with the owner and the live object:

```bash
kubectl describe pod -l app=klustered
kubectl get pod -l app=klustered -oyaml
kubectl get deploy klustered -oyaml
```

**What to Notice:**

- Is the pod controlled by the `klustered` Deployment's ReplicaSet?
- Do the live pod's container settings match the Deployment template?
- Does `kubectl describe pod` show any unusual status, conditions, or recent events?

::hint-box
---
:summary: "Hint 1: Where to Look"
---

The suspicious field is not on the Service or Deployment selector. It is inside the live pod's container resources.

Compare the pod's `spec.containers[].resources` with the Deployment's `spec.template.spec.containers[].resources`.

```bash
kubectl get pod -l app=klustered -o jsonpath='{.items[0].spec.containers[0].resources}{"\n"}'
kubectl get deploy klustered -o jsonpath='{.spec.template.spec.containers[0].resources}{"\n"}'
```

::

::hint-box
---
:summary: "Hint 2: The Concept"
---

Kubernetes supports [in-place pod resizing](https://kubernetes.io/docs/tasks/configure-pod-container/resize-container-resources/). A pod's resource requests and limits can be changed through the `resize` subresource without editing the owning Deployment.

That is useful when done intentionally, but it also creates a trap: the pod you are looking at is no longer a clean copy of the Deployment template. The Deployment still describes modest resources, while the live pod has been mutated to request `32Gi` of memory with a `64Gi` limit.

::

::hint-box
---
:summary: "Hint 3: The Fix"
---

There are two reasonable ways out:

- Patch the live pod back to the resources declared by the Deployment template.
- Delete the pod and let the Deployment recreate it from the clean template.

In this challenge, pod creation has another trap waiting for you, so patching in place lets you fix this problem without depending on a replacement pod yet. Use the pod name from `kubectl get pods`:

```bash
kubectl patch pod <pod-name> \
  --subresource resize \
  -p '{"spec":{"containers":[{"name":"klustered","resources":{"requests":{"memory":"128Mi","cpu":"100m"},"limits":{"memory":"256Mi","cpu":"500m"}}}]}}'
```

Then check it again:

```bash
kubectl describe pod -l app=klustered
kubectl get pod -l app=klustered -o jsonpath='{.items[0].spec.containers[0].resources}{"\n"}'
```

If you choose to delete the pod instead and it does not come back, keep going. That failure is the next thing to investigate.

```bash
kubectl delete pod -l app=klustered
```

::

---

### Step 2: Rollout & Reconcile

Now try to roll the app forward. If it does not complete, stop and inspect what Kubernetes tried to do next:

```bash
kubectl set image deployment/klustered klustered=ghcr.io/rawkode-academy/klustered:v2
kubectl rollout status deployment/klustered --timeout=30s
```

Compare the desired state with what the controllers actually created:

```bash
kubectl get deployments,replicasets,pods
kubectl describe deploy klustered
kubectl describe rs -l app=klustered
kubectl get events --sort-by=.lastTimestamp
```

**What to Notice:**

- Did the Deployment template change to `v2`?
- Did a new ReplicaSet appear?
- If there is a new ReplicaSet, did it create a replacement pod?
- Do the events show an API rejection yet, or is something simply not reconciling?

::hint-box
---
:summary: "Hint 1: Where to Look"
---

If desired state changed but nothing is bringing actual state along with it, look outside the application namespace. The component that runs Deployment and ReplicaSet reconciliation lives in `kube-system`.

```bash
kubectl -n kube-system get pods -o wide
kubectl -n kube-system get pods | grep controller-manager
```

Then inspect that pod and its logs:

```bash
kubectl -n kube-system describe pod -l component=kube-controller-manager
kubectl -n kube-system logs -l component=kube-controller-manager --tail=100
```

If the label selector does not match in your cluster, copy the controller-manager pod name from the `kubectl get pods` output.

::

::hint-box
---
:summary: "Hint 2: The Concept"
---

The API server stores the new desired state when you run `kubectl set image`, but it does not perform the rollout itself. The controller manager runs the reconciliation loops that notice changed Deployments, create ReplicaSets, and make ReplicaSets create Pods.

`kube-controller-manager` has a `--controllers` flag. Kubernetes documents that `*` enables default controllers and `-foo` disables a named controller. In this scenario, that flag has been changed so ReplicaSets cannot reconcile their Pods.

::

::hint-box
---
:summary: "Hint 3: The Fix"
---

Inspect the controller-manager static pod manifest and remove `,-replicaset-controller` from the `--controllers` argument:

```bash
grep -n -- "--controllers" /etc/kubernetes/manifests/kube-controller-manager*.yaml
sed -i.bak 's/,-replicaset-controller//g' /etc/kubernetes/manifests/kube-controller-manager*.yaml
grep -n -- "--controllers" /etc/kubernetes/manifests/kube-controller-manager*.yaml
```

The kubelet should restart the static pod after the manifest changes. Watch it come back:

```bash
kubectl -n kube-system get pods | grep controller-manager
kubectl rollout status deployment/klustered --timeout=30s
```

::

---

### Step 3: Validation is Important

Once the controllers are reconciling again, inspect the rollout one more time:

```bash
kubectl get deployments,replicasets,pods
kubectl get events --sort-by=.lastTimestamp
```

This time there should be an explicit failure message in the event stream. Read it carefully before changing anything else.

::hint-box
---
:summary: "Hint 1: Where to Look"
---

The error message mentions that only pods whose names start with `kube-` may be created. That is not a scheduler problem, and it is not an image pull problem.

Look for admission resources:

```bash
kubectl get validatingadmissionpolicies,validatingadmissionpolicybindings
```

::

::hint-box
---
:summary: "Hint 2: The Concept"
---

A `ValidatingAdmissionPolicy` can reject API requests before objects are persisted. In this level, the policy targets `CREATE` operations for pods in the `default` namespace.

Deployments do not update a running container in place when you change the image. They create a new ReplicaSet, and that ReplicaSet creates new pods. The policy denies those new `klustered-*` pods because their names do not start with `kube-`.

::

::hint-box
---
:summary: "Hint 3: The Fix"
---

Remove the binding first, then the policy:

```bash
kubectl delete validatingadmissionpolicybinding namespace-guard-binding
kubectl delete validatingadmissionpolicy namespace-guard
```

If your rollout was already started, Kubernetes should retry once the admission policy is gone. If it does not, restart the rollout command:

```bash
kubectl rollout status deployment/klustered
```

::

---

### Step 4: Let's Ship

With the blockers removed, roll the Deployment forward:

```bash
kubectl set image deployment/klustered klustered=ghcr.io/rawkode-academy/klustered:v2
kubectl rollout status deployment/klustered
```

If you already ran `kubectl set image` in Step 2, you do not need to run it again. Just watch the rollout finish.

Refresh the **App** tab. Dance party.
