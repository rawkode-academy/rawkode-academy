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

    state "Phase 0: Resolve Secrets" as Phase0 {
        [*] --> InfisicalAuth: Credentials provided?
        InfisicalAuth --> FetchSecrets: Yes — Universal Auth
        InfisicalAuth --> Validate: No — skip
        FetchSecrets --> Backfill: map[string]string
        Backfill --> Validate
        Validate --> [*]: Required fields present
    }

    Phase0 --> Phase1

    state "Phase 1: Order Server + Install" as Phase1 {
        [*] --> ListSSHKeys: IAM API
        ListSSHKeys --> CreateServer: SSH key IDs (required by Scaleway)
        note right of CreateServer
            CreateServerRequest includes:
            - Install{OsID, Hostname, SSHKeyIDs}
            - UserData (cloud-init bytes)
            Scaleway auto-starts OS install
            when hardware is allocated.
        end note
        CreateServer --> RegisterCleanup: Server ID known
        RegisterCleanup --> [*]
    }

    Phase1 --> Phase2

    state "Phase 2: Wait for Install + Talos Boot" as Phase2 {
        [*] --> PollReady: GET /servers/{id} every 30s
        PollReady --> PollReady: Status: delivering/installing
        PollReady --> ExtractIP: Status: ready
        ExtractIP --> WaitTalos: gRPC Version() on :50000
        WaitTalos --> WaitTalos: Not responding (10s interval)
        WaitTalos --> [*]: Talos maintenance mode confirmed
    }

    Phase2 --> Phase3

    state "Phase 3: Update DNS" as Phase3 {
        [*] --> CheckConfig: Cloudflare configured?
        CheckConfig --> UpsertA: Yes
        CheckConfig --> SkipDNS: No — warn and continue
        UpsertA --> [*]: A record → server IP
        SkipDNS --> [*]
    }

    Phase3 --> Phase4

    state "Phase 4: Generate Config" as Phase4 {
        [*] --> DetectOperatorIP: checkip.amazonaws.com
        DetectOperatorIP --> GenerateTeleportToken: 30-min TTL, RoleKube
        GenerateTeleportToken --> GenerateTalosConfig
        note right of GenerateTalosConfig
            In-memory PKI generation:
            - CA certs + keys
            - etcd CA
            - K8s bootstrap tokens
            - talosconfig (mTLS client creds)
        end note
        GenerateTalosConfig --> InjectManifests
        note right of InjectManifests
            Inline K8s manifests:
            1. infisical-machine-identity Secret
               (clientId + clientSecret)
            2. teleport-join-token Secret
               (token + proxy addr)
        end note
        InjectManifests --> AddFirewallRules
        note right of AddFirewallRules
            NetworkRuleConfig documents:
            - operator-talos-api (TCP/50000)
            - operator-kube-api (TCP/6443)
            Source: operator IP /32 only
        end note
        AddFirewallRules --> [*]: MachineConfig + LockdownConfig + TalosConfig
    }

    Phase4 --> Phase5

    state "Phase 5: Bootstrap Cluster" as Phase5 {
        [*] --> ApplyConfig: Insecure gRPC :50000 (maintenance mode)
        ApplyConfig --> WaitReboot: Node reboots into cluster mode
        WaitReboot --> WaitMTLS: mTLS Version() poll (10s)
        WaitMTLS --> Bootstrap: etcd Bootstrap RPC
        Bootstrap --> WaitK8s: ServiceList poll (15s)
        note right of WaitK8s
            Required services:
            ✓ etcd (Running + Healthy)
            ✓ kubelet (Running + Healthy)
            ✓ apid (Running + Healthy)
            ✓ trustd (Running + Healthy)
        end note
        WaitK8s --> [*]: Kubernetes ready
    }

    Phase5 --> Phase6

    state "Phase 6: Verify + Lockdown" as Phase6 {
        [*] --> WaitAgent: GetKubernetesServers() poll (15s)
        WaitAgent --> AgentFound: Cluster name matches
        WaitAgent --> VerifyFailed: 10-min timeout
        AgentFound --> Lockdown: Re-apply config WITHOUT firewall rules
        note right of Lockdown
            Ports 50000 + 6443 no longer
            accessible from public internet.
            All access via Teleport tunnel.
        end note
        Lockdown --> [*]: ✓ Provisioning complete
        VerifyFailed --> LeftRunning: skipCleanup = true
        note right of LeftRunning
            Server NOT deleted.
            Firewall NOT locked.
            Manual debug required.
        end note
    }

    Phase6 --> [*]: Success

    Phase1 --> Cleanup: Any failure (phases 1-5)
    Phase2 --> Cleanup: Any failure
    Phase3 --> Cleanup: Any failure
    Phase4 --> Cleanup: Any failure
    Phase5 --> Cleanup: Any failure

    state "Cleanup (LIFO)" as Cleanup {
        [*] --> DeleteServer: 5-min timeout
    }
```

### Communication Flow

```mermaid
sequenceDiagram
    participant CLI as rawkode-cloud CLI
    participant Inf as Infisical
    participant SCW as Scaleway API
    participant Server as Bare Metal Server
    participant CF as Cloudflare DNS
    participant TP as Teleport Proxy
    participant IPS as IP Detection Service

    Note over CLI: Phase 0 — Resolve Secrets
    CLI->>Inf: Universal Auth (clientID + clientSecret)
    Inf-->>CLI: Access token
    CLI->>Inf: List secrets (project/env/path)
    Inf-->>CLI: map[string]string (backfill config)

    Note over CLI: Phase 1 — Order Server + Install
    CLI->>SCW: IAM ListSSHKeys()
    SCW-->>CLI: SSH key IDs (required for install)
    CLI->>SCW: CreateServer(offer, install{osID, sshKeyIDs}, userData{cloud-init})
    SCW-->>CLI: Server{ID, status: delivering}

    Note over CLI: Phase 2 — Wait + Talos Boot
    loop Poll every 30s (up to 45 min)
        CLI->>SCW: GetServer(serverID)
        SCW-->>CLI: Server{status, IPs}
    end
    Note over Server: Hardware allocated → Ubuntu installed → cloud-init runs
    Note over Server: Cloud-init: wget Talos image → verify SHA256 → dd to disk → reboot
    loop Poll gRPC every 10s (up to 20 min)
        CLI->>Server: gRPC Version() on :50000 (insecure)
        Server-->>CLI: Talos version (maintenance mode)
    end

    Note over CLI: Phase 3 — DNS Update
    CLI->>CF: GET /dns_records?type=A&name=rawkode.cloud
    CF-->>CLI: Existing record (or empty)
    CLI->>CF: PUT/POST A record → server IP (TTL: 60s)
    CF-->>CLI: OK

    Note over CLI: Phase 4 — Generate Config
    CLI->>IPS: GET https://checkip.amazonaws.com
    IPS-->>CLI: Operator public IP
    CLI->>TP: CreateToken(RoleKube, 30-min TTL)
    TP-->>CLI: Join token name
    Note over CLI: Generate Talos PKI + machine config in memory

    Note over CLI: Phase 5 — Bootstrap
    CLI->>Server: gRPC ApplyConfiguration(:50000, insecure)
    Note over Server: Reboot into cluster mode
    loop mTLS poll every 10s (up to 10 min)
        CLI->>Server: gRPC Version(:50000, mTLS)
        Server-->>CLI: OK
    end
    CLI->>Server: gRPC Bootstrap (etcd init)
    loop ServiceList poll every 15s (up to 10 min)
        CLI->>Server: gRPC ServiceList (mTLS)
        Server-->>CLI: etcd ✓ kubelet ✓ apid ✓ trustd ✓
    end

    Note over CLI: Phase 6 — Verify + Lockdown
    loop Poll every 15s (up to 10 min)
        CLI->>TP: GetKubernetesServers()
        TP-->>CLI: Registered agents list
    end
    Note over CLI: Agent found — cluster connected to Teleport
    CLI->>Server: gRPC ApplyConfiguration (mTLS, NO firewall rules)
    Note over Server: Ports 50000 + 6443 blocked from public internet
    Note over Server: All access now via Teleport tunnel only
```

### Rollback Semantics

```mermaid
flowchart TD
    P1[Phase 1: Order Server] -->|success| P2[Phase 2: Wait + Talos Boot]
    P2 -->|success| P3[Phase 3: DNS Update]
    P3 -->|success| P4[Phase 4: Generate Config]
    P4 -->|success| P5[Phase 5: Bootstrap]
    P5 -->|success| P6[Phase 6: Verify + Lockdown]
    P6 -->|success| Done[✓ Complete — skipCleanup]

    P1 -->|failure| C[Cleanup: Delete Server]
    P2 -->|failure| C
    P3 -->|failure| C
    P4 -->|failure| C
    P5 -->|failure| C

    P6 -->|Teleport verify fails| NoClean[Server LEFT RUNNING]
    NoClean --- Note1[Firewall NOT locked]
    NoClean --- Note2[Manual debug required]
    NoClean --- Note3[skipCleanup = true]

    P6 -->|lockdown fails| C
```
