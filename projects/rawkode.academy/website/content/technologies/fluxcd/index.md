---
description: FluxCD is a GitOps operator for Kubernetes, designed to automate the deployment and management of applications. It synchronizes the state of your Kubernetes cluster with configurations stored in Git repositories. FluxCD continuously monitors these repositories for changes and automatically applies updates to the cluster, ensuring that the desired state defined in Git is always reflected in your running environment. This approach enhances consistency, auditability, and reliability in Kubernetes deployments by leveraging Git as the single source of truth. It also provides a way to roll back to previous versions in case of errors or unexpected issues.
name: FluxCD
website: https://fluxcd.io/
documentation: https://fluxcd.io/flux/get-started/
categories: []
---

## Complete Guide to FluxCD: GitOps for Kubernetes

FluxCD is the leading GitOps tool for Kubernetes, enabling teams to manage infrastructure and applications declaratively through Git. If you're looking to automate Kubernetes deployments, improve security, and establish Git as your single source of truth, FluxCD is the solution.

## What is FluxCD?

FluxCD is a CNCF graduated project that implements GitOps for Kubernetes. It continuously monitors Git repositories and container registries, automatically applying changes to your cluster to ensure the actual state matches the desired state defined in Git.

**Core Principle:** Your Git repository is the single source of truth. All cluster changes go through Git, providing complete audit trails, easy rollbacks, and declarative infrastructure management.

## Why FluxCD?

### Traditional vs. GitOps Deployment

**Traditional Approach:**
- Manual kubectl commands or scripts
- No audit trail of who changed what
- Difficult rollbacks
- Configuration drift over time
- Credentials scattered across CI/CD systems

**FluxCD GitOps Approach:**
- All changes via Git pull requests
- Complete audit trail automatically
- Easy rollbacks (git revert)
- Cluster state continuously reconciled
- No cluster credentials in CI/CD

### Key Benefits

1. **Declarative**: Define your desired state in Git, Flux makes it happen
2. **Automated**: Continuous synchronization without manual intervention
3. **Secure**: No cluster credentials needed outside the cluster
4. **Auditable**: Every change tracked in Git history
5. **Recoverable**: Disaster recovery is as simple as pointing Flux at your Git repo

## Core Concepts

### GitOps Toolkit Components

FluxCD v2 is built on the GitOps Toolkit, a set of composable APIs:

#### Source Controller
Manages Git repositories and Helm repositories as sources:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: podinfo
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/stefanprodan/podinfo
  ref:
    branch: master
```

#### Kustomize Controller
Reconciles Kustomize overlays:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: podinfo
  namespace: flux-system
spec:
  interval: 5m
  path: ./kustomize
  prune: true
  sourceRef:
    kind: GitRepository
    name: podinfo
```

#### Helm Controller
Manages Helm releases:

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind:HelmRelease
metadata:
  name: nginx
  namespace: default
spec:
  interval: 5m
  chart:
    spec:
      chart: nginx
      version: "15.x"
      sourceRef:
        kind: HelmRepository
        name: bitnami
```

#### Notification Controller
Sends alerts and receives webhooks:

```yaml
apiVersion: notification.toolkit.fluxcd.io/v1
kind: Alert
metadata:
  name: on-call
  namespace: flux-system
spec:
  providerRef:
    name: slack
  eventSeverity: error
  eventSources:
    - kind: Kustomization
      name: '*'
```

#### Image Automation Controllers
Automatically update image tags:

```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: podinfo
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: podinfo
  policy:
    semver:
      range: 5.0.x
```

## Getting Started with FluxCD

### Prerequisites

- A Kubernetes cluster (kind, minikube, or cloud)
- kubectl configured
- A Git repository
- GitHub/GitLab personal access token

### Installation

```bash
# Install Flux CLI
brew install fluxcd/tap/flux

# Check prerequisites
flux check --pre

# Bootstrap Flux on your cluster
flux bootstrap github \
  --owner=your-username \
  --repository=fleet-infra \
  --branch=main \
  --path=./clusters/my-cluster \
  --personal
```

This single command:
1. Installs Flux components
2. Creates a Git repository (if needed)
3. Commits Flux manifests to your repo
4. Configures Flux to sync from that repo

### Deploy Your First Application

Create a Git repository structure:

```
fleet-infra/
├── clusters/
│   └── my-cluster/
│       ├── flux-system/        # Flux components (auto-generated)
│       └── apps/
│           └── podinfo/
│               ├── namespace.yaml
│               ├── deployment.yaml
│               └── service.yaml
```

```yaml
# apps/podinfo/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: podinfo
  namespace: podinfo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: podinfo
  template:
    metadata:
      labels:
        app: podinfo
    spec:
      containers:
      - name: podinfo
        image: ghcr.io/stefanprodan/podinfo:6.5.0
        ports:
        - containerPort: 9898
```

Create a Kustomization to deploy it:

```yaml
# clusters/my-cluster/apps.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
  namespace: flux-system
spec:
  interval: 10m
  path: ./apps
  prune: true
  sourceRef:
    kind: GitRepository
    name: flux-system
```

Commit and push—Flux deploys automatically!

```bash
git add .
git commit -m "Add podinfo application"
git push

# Watch Flux deploy
flux get kustomizations --watch
```

## Common Use Cases

### 1. Multi-Environment Management

Structure your repo for dev, staging, and prod:

```
fleet-infra/
├── clusters/
│   ├── dev/
│   ├── staging/
│   └── production/
└── apps/
    └── podinfo/
        ├── base/
        └── overlays/
            ├── dev/
            ├── staging/
            └── production/
```

### 2. Multi-Tenancy

Use Flux's multi-tenancy lockdown:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: team-a
  namespace: flux-system
spec:
  serviceAccountName: team-a
  path: ./teams/team-a
  sourceRef:
    kind: GitRepository
    name: flux-system
```

### 3. Progressive Delivery with Flagger

Integrate Flagger for canary deployments:

```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: podinfo
  namespace: podinfo
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: podinfo
  service:
    port: 9898
  analysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
```

### 4. Image Automation

Automatically update images when new versions are pushed:

```yaml
# Update deployment with new image versions
apiVersion: image.toolkit.fluxcd.io/v1beta1
kind: ImageUpdateAutomation
metadata:
  name: podinfo
  namespace: flux-system
spec:
  git:
    commit:
      author:
        email: fluxcdbot@users.noreply.github.com
        name: fluxcdbot
      messageTemplate: 'Update image to {{range .Updated.Images}}{{println .}}{{end}}'
  interval: 1m
  sourceRef:
    kind: GitRepository
    name: flux-system
  update:
    path: ./apps/podinfo
    strategy: Setters
```

## Best Practices

### Repository Structure

**Option 1: Monorepo**
- Single repository for all environments
- Use Kustomize overlays for environment-specific configs
- Simpler for small teams

**Option 2: Repo-per-environment**
- Separate repos for dev, staging, production
- Better access control
- Scales for larger organizations

### Secret Management

Never commit secrets to Git! Use one of these approaches:

**1. Mozilla SOPS:**
```bash
# Install SOPS provider
flux create secret sops my-secrets \
  --namespace=flux-system \
  --from-literal=token=ghp_xxx

# Encrypt with SOPS
sops --encrypt --in-place secret.yaml
```

**2. External Secrets Operator:**
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: example
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault
    kind: SecretStore
  target:
    name: secret-to-create
  data:
  - secretKey: password
    remoteRef:
      key: secret/data/password
```

**3. Sealed Secrets:**
```bash
# Encrypt a secret
kubeseal < secret.yaml > sealed-secret.yaml
# Commit sealed-secret.yaml to Git
```

### Health Checks and Validation

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
spec:
  interval: 10m
  path: ./apps
  prune: true
  wait: true  # Wait for resources to be ready
  timeout: 5m
  validation: client  # Validate before applying
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: podinfo
      namespace: podinfo
```

### Notifications

Stay informed about deployments:

```yaml
# Send to Slack
apiVersion: notification.toolkit.fluxcd.io/v1beta1
kind: Provider
metadata:
  name: slack
  namespace: flux-system
spec:
  type: slack
  channel: deployments
  secretRef:
    name: slack-url

---
apiVersion: notification.toolkit.fluxcd.io/v1beta1
kind: Alert
metadata:
  name: slack-info
  namespace: flux-system
spec:
  providerRef:
    name: slack
  eventSeverity: info
  eventSources:
    - kind: Kustomization
      name: '*'
    - kind: HelmRelease
      name: '*'
```

## FluxCD vs. ArgoCD

Both are excellent GitOps tools. Here's how they compare:

| Feature | FluxCD | ArgoCD |
|---------|--------|--------|
| **Architecture** | Lightweight, toolkit-based | Monolithic with UI |
| **UI** | Optional (Weave GitOps) | Built-in, feature-rich |
| **Multi-tenancy** | Native support | Good support |
| **Helm** | HelmController | Native support |
| **Image automation** | Built-in | Plugin required |
| **Complexity** | Lower learning curve | More features, steeper curve |
| **CNCF Status** | Graduated | Graduated |

**Choose FluxCD if:**
- You prefer lightweight, composable tools
- You want built-in image automation
- You're comfortable with CLI/GitOps workflows

**Choose ArgoCD if:**
- You need a comprehensive UI for non-technical users
- You want application-centric management
- You need advanced RBAC with UI

## Common Pitfalls

1. **Forgetting Source Interval**: Set appropriate intervals for Git polling
2. **No Health Checks**: Always configure health checks for critical apps
3. **Committing Secrets**: Use SOPS, Sealed Secrets, or External Secrets
4. **Ignoring Dependencies**: Use `dependsOn` to order deployments
5. **Not Using Prune**: Set `prune: true` to remove deleted resources

## Troubleshooting

```bash
# Check Flux status
flux check

# Get all Flux resources
flux get all

# Describe a Kustomization
flux get kustomization apps

# View logs
flux logs --all-namespaces --follow

# Suspend/Resume reconciliation
flux suspend kustomization apps
flux resume kustomization apps

# Force reconciliation
flux reconcile kustomization apps --with-source
```

## Learning Path

### Beginner
1. Understand GitOps principles
2. Install Flux on a local cluster
3. Deploy your first application via Git
4. Learn Kustomize basics
5. Set up notifications

### Intermediate
1. Manage multiple environments
2. Implement secret management with SOPS
3. Automate image updates
4. Configure health checks and dependencies
5. Use Helm with Flux

### Advanced
1. Implement multi-tenancy
2. Progressive delivery with Flagger
3. Multi-cluster management
4. Custom automation with Flux APIs
5. Disaster recovery strategies

## Conclusion

FluxCD brings the power of GitOps to Kubernetes, making deployments safer, more auditable, and fully automated. By treating Git as the single source of truth, you gain version control, peer review, and rollback capabilities for your entire infrastructure.

Start with a single application, experience the GitOps workflow, and gradually expand to manage your entire Kubernetes estate through Git.

**Want to see Flux in action?** Check out our hands-on videos below for real-world examples and advanced patterns.
