# rawkode-cloud

Bare metal to immutable Kubernetes provisioning CLI.

Provisions physical bare metal servers from Scaleway, pivots them to Talos Linux, bootstraps a Kubernetes cluster, and secures access through Teleport — all with a single command.

No SSH. No local state. Verify-then-lockdown.

## Usage

```bash
# Provision with Infisical resolving all secrets
rawkode-cloud provision \
  --infisical-url https://infisical.example.com \
  --infisical-client-id $CLIENT_ID \
  --infisical-client-secret $CLIENT_SECRET \
  --infisical-project-id $PROJECT_ID

# Provision with explicit flags
rawkode-cloud provision \
  --cluster-name my-cluster \
  --scaleway-offer-id $OFFER_ID \
  --scaleway-os-id $OS_ID \
  --scaleway-access-key $SCW_ACCESS_KEY \
  --scaleway-secret-key $SCW_SECRET_KEY \
  --teleport-proxy teleport.example.com:443 \
  --cloudflare-api-token $CF_API_TOKEN \
  --cloudflare-zone-id $CF_ZONE_ID \
  --cloudflare-dns-name rawkode.cloud

# Destroy a failed provisioning run
rawkode-cloud destroy --server-id $SERVER_ID
```

## Configuration

All settings can come from a config file (`~/.rawkode-cloud.yaml`), environment variables (`RAWKODE_CLOUD_*`), CLI flags, or Infisical secrets. Precedence (lowest to highest):

1. Config file
2. Environment variables
3. CLI flags
4. Infisical (backfills missing values)

## Architecture

### Provisioning Pipeline

7 phases, executed sequentially. Failure at any phase triggers LIFO cleanup (server deletion), except Phase 6 Teleport verification failure which leaves the server running for manual debug.

| Phase | Name | What happens |
|-------|------|-------------|
| 0 | Resolve Secrets | Authenticate with Infisical, fetch and backfill config |
| 1 | Order Server + Install | Single Scaleway API call: create server with OS install + cloud-init |
| 2 | Wait + Talos Boot | Poll Scaleway for ready, then poll Talos gRPC for maintenance mode |
| 3 | Update DNS | Upsert Cloudflare A record pointing at server IP |
| 4 | Generate Config | Detect operator IP, mint Teleport token, generate Talos PKI + manifests |
| 5 | Bootstrap Cluster | Apply config, bootstrap etcd, wait for Kubernetes readiness |
| 6 | Verify + Lockdown | Confirm Teleport agent registered, then remove firewall rules |

### State Machine

```mermaid
stateDiagram-v2
    [*] --> Phase0

    state "Phase 0 - Resolve Secrets" as Phase0 {
        [*] --> InfisicalAuth
        InfisicalAuth --> FetchSecrets: Credentials provided
        InfisicalAuth --> Validate: No credentials, skip
        FetchSecrets --> Backfill
        Backfill --> Validate
        Validate --> [*]
    }

    Phase0 --> Phase1

    state "Phase 1 - Order Server + Install" as Phase1 {
        [*] --> ListSSHKeys
        ListSSHKeys --> CreateServer
        CreateServer --> RegisterCleanup
        RegisterCleanup --> [*]
    }

    Phase1 --> Phase2

    state "Phase 2 - Wait for Install + Talos Boot" as Phase2 {
        [*] --> PollReady
        PollReady --> PollReady: Still delivering
        PollReady --> ExtractIP: Server ready
        ExtractIP --> WaitTalos
        WaitTalos --> WaitTalos: Not responding
        WaitTalos --> [*]: Maintenance mode
    }

    Phase2 --> Phase3

    state "Phase 3 - Update DNS" as Phase3 {
        [*] --> CheckConfig
        CheckConfig --> UpsertA: Cloudflare configured
        CheckConfig --> SkipDNS: Not configured
        UpsertA --> [*]
        SkipDNS --> [*]
    }

    Phase3 --> Phase4

    state "Phase 4 - Generate Config" as Phase4 {
        [*] --> DetectOperatorIP
        DetectOperatorIP --> GenerateTeleportToken
        GenerateTeleportToken --> GenerateTalosConfig
        GenerateTalosConfig --> InjectManifests
        InjectManifests --> AddFirewallRules
        AddFirewallRules --> [*]
    }

    Phase4 --> Phase5

    state "Phase 5 - Bootstrap Cluster" as Phase5 {
        [*] --> ApplyConfig
        ApplyConfig --> WaitReboot
        WaitReboot --> WaitMTLS
        WaitMTLS --> Bootstrap
        Bootstrap --> WaitK8s
        WaitK8s --> [*]: All services healthy
    }

    Phase5 --> Phase6

    state "Phase 6 - Verify + Lockdown" as Phase6 {
        [*] --> WaitAgent
        WaitAgent --> AgentFound: Cluster registered
        WaitAgent --> VerifyFailed: 10 min timeout
        AgentFound --> Lockdown
        Lockdown --> [*]: Provisioning complete
        VerifyFailed --> LeftRunning: Server left for debug
    }

    Phase6 --> [*]: Success

    Phase1 --> Cleanup: Failure
    Phase2 --> Cleanup: Failure
    Phase3 --> Cleanup: Failure
    Phase4 --> Cleanup: Failure
    Phase5 --> Cleanup: Failure

    state "Cleanup - LIFO" as Cleanup {
        [*] --> DeleteServer
    }
```

**Phase details:**

| Phase | Step | Detail |
|-------|------|--------|
| 1 | ListSSHKeys | IAM API — required by Scaleway for bare metal install |
| 1 | CreateServer | Single API call with Install + UserData (cloud-init). Scaleway auto-starts OS install on hardware allocation |
| 2 | PollReady | GET /servers/{id} every 30s, up to 45 min |
| 2 | WaitTalos | gRPC Version() on port 50000 every 10s, up to 20 min |
| 4 | DetectOperatorIP | checkip.amazonaws.com for firewall scoping |
| 4 | GenerateTeleportToken | 30-min TTL, RoleKube |
| 4 | GenerateTalosConfig | In-memory PKI: CA certs, etcd CA, K8s bootstrap tokens, talosconfig (mTLS) |
| 4 | InjectManifests | infisical-machine-identity Secret (clientId + clientSecret), teleport-join-token Secret |
| 4 | AddFirewallRules | operator-talos-api (TCP/50000) + operator-kube-api (TCP/6443), operator IP /32 only |
| 5 | ApplyConfig | Insecure gRPC on port 50000 (maintenance mode) |
| 5 | WaitK8s | etcd + kubelet + apid + trustd must be Running + Healthy |
| 6 | Lockdown | Re-apply config WITHOUT firewall rules. Ports 50000 + 6443 blocked from public internet |
| 6 | VerifyFailed | Server NOT deleted, firewall NOT locked — manual debug required |

### Communication Flow

```mermaid
sequenceDiagram
    participant CLI as rawkode-cloud CLI
    participant Inf as Infisical
    participant SCW as Scaleway API
    participant Server as Bare Metal Server
    participant CF as Cloudflare DNS
    participant TP as Teleport Proxy
    participant IPS as IP Detection

    Note over CLI: Phase 0
    CLI->>Inf: Universal Auth
    Inf-->>CLI: Access token
    CLI->>Inf: List secrets
    Inf-->>CLI: Config values

    Note over CLI: Phase 1
    CLI->>SCW: IAM ListSSHKeys
    SCW-->>CLI: SSH key IDs
    CLI->>SCW: CreateServer with Install + cloud-init
    SCW-->>CLI: Server ID

    Note over CLI: Phase 2
    loop Every 30s up to 45 min
        CLI->>SCW: GetServer
        SCW-->>CLI: Status + IPs
    end
    Note over Server: Ubuntu installed, cloud-init pivots to Talos, reboot
    loop Every 10s up to 20 min
        CLI->>Server: gRPC Version on 50000
        Server-->>CLI: Talos maintenance mode
    end

    Note over CLI: Phase 3
    CLI->>CF: List A records
    CF-->>CLI: Existing record or empty
    CLI->>CF: Upsert A record to server IP
    CF-->>CLI: OK

    Note over CLI: Phase 4
    CLI->>IPS: GET public IP
    IPS-->>CLI: Operator IP
    CLI->>TP: CreateToken 30min TTL
    TP-->>CLI: Join token
    Note over CLI: Generate Talos PKI + manifests in memory

    Note over CLI: Phase 5
    CLI->>Server: gRPC ApplyConfiguration
    Note over Server: Reboot into cluster mode
    loop mTLS poll every 10s
        CLI->>Server: gRPC Version with mTLS
        Server-->>CLI: OK
    end
    CLI->>Server: gRPC Bootstrap etcd
    loop Every 15s up to 10 min
        CLI->>Server: gRPC ServiceList
        Server-->>CLI: All services healthy
    end

    Note over CLI: Phase 6
    loop Every 15s up to 10 min
        CLI->>TP: GetKubernetesServers
        TP-->>CLI: Registered agents
    end
    Note over CLI: Agent found
    CLI->>Server: ApplyConfiguration without firewall rules
    Note over Server: Ports 50000 + 6443 now blocked
```

### Rollback Semantics

```mermaid
flowchart TD
    P1["Phase 1: Order Server"] -->|success| P2["Phase 2: Wait + Talos Boot"]
    P2 -->|success| P3["Phase 3: DNS Update"]
    P3 -->|success| P4["Phase 4: Generate Config"]
    P4 -->|success| P5["Phase 5: Bootstrap"]
    P5 -->|success| P6["Phase 6: Verify + Lockdown"]
    P6 -->|success| Done["Complete - skipCleanup"]

    P1 -->|failure| C["Cleanup: Delete Server"]
    P2 -->|failure| C
    P3 -->|failure| C
    P4 -->|failure| C
    P5 -->|failure| C

    P6 -->|verify fails| NoClean["Server LEFT RUNNING"]
    NoClean --- Note1["Firewall NOT locked"]
    NoClean --- Note2["Manual debug required"]

    P6 -->|lockdown fails| C
```
