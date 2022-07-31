import { RandomPassword } from "@pulumi/random";
import * as kubernetes from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as doppler from "@pulumiverse/doppler";
import * as slug from "slug";

export interface ProjectArgs {
  repository: string;
  directory: string;
  platformDependency: pulumi.Resource[];
  provider: kubernetes.Provider;
  requireSecrets: string[];
  environment: { [key: string]: string };
}

export class Project extends pulumi.ComponentResource {
  private namespace: kubernetes.core.v1.Namespace;
  private configMap: kubernetes.core.v1.ConfigMap;
  private operatorServiceAccount: kubernetes.core.v1.ServiceAccount;
  private operatorRole: kubernetes.rbac.v1.Role;
  private operatorRoleBinding: kubernetes.rbac.v1.RoleBinding;
  private stackSecret: RandomPassword;
  private persistentVolumeClaim: kubernetes.core.v1.PersistentVolumeClaim;
  private operator: kubernetes.apps.v1.Deployment;
  private pulumiKubernetesSecret: kubernetes.core.v1.Secret;
  private stack: kubernetes.apiextensions.CustomResource;

  constructor(
    name: string,
    args: ProjectArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("rawkode:platform:Project", name, args, opts);

    const slugName = slug(name);
    const provider = args.provider;

    // Create Doppler Project
    const dopplerProject = new doppler.Project(slugName, {
      name,
      description: "Project Created by Rawkode Academy Platform",
    });

    const dopplerEnvironment = new doppler.Environment(
      `${slugName}-production`,
      {
        name: "Production",
        slug: "production",
        project: dopplerProject.id,
      },
      { parent: dopplerProject, deleteBeforeReplace: true }
    );

    args.requireSecrets.forEach(
      (secret) =>
        new doppler.Secret(
          `${slugName}-production-${slug(secret)}`,
          {
            name: secret,
            project: dopplerProject.id,
            config: "production",
            value: `\${core.global.${secret}}`,
          },
          { parent: dopplerEnvironment }
        )
    );

    const dopplerServiceTokenR = new doppler.ServiceToken(
      `${slugName}-production-service-token-r`,
      {
        name: "doppler-operator",
        project: dopplerProject.id,
        config: "production",
        access: "read",
      },
      { parent: dopplerEnvironment }
    );

    const dopplerServiceTokenRW = new doppler.ServiceToken(
      `${slugName}-production-service-token-rw`,
      {
        name: "pulumi",
        project: dopplerProject.id,
        config: "production",
        access: "read/write",
      },
      { parent: dopplerEnvironment }
    );

    const dopplerSecretServiceToken = new doppler.Secret(
      `${slugName}-production-service-token-rw-inception`,
      {
        name: "DOPPLER_TOKEN",
        project: dopplerProject.id,
        config: "production",
        value: dopplerServiceTokenRW.key,
      },
      { parent: dopplerEnvironment }
    );

    this.namespace = new kubernetes.core.v1.Namespace(
      slugName,
      {
        // Disable auto-naming on this namespace for consistent experience for developers
        metadata: {
          name,
        },
      },
      { provider, parent: this }
    );
    const namespace = this.namespace.metadata.name;

    const dopplerCmsToken = new kubernetes.core.v1.Secret(
      `${slugName}-doppler-operator`,
      {
        metadata: {
          namespace: this.namespace.metadata.name,
        },
        data: {
          serviceToken: dopplerServiceTokenR.key.apply((key) =>
            Buffer.from(key).toString("base64")
          ),
        },
      },
      {
        provider,
      }
    );

    const dopplerSecret = new kubernetes.apiextensions.CustomResource(
      `${slugName}-doppler-operator-secret`,
      {
        apiVersion: "secrets.doppler.com/v1alpha1",
        kind: "DopplerSecret",
        metadata: {
          namespace: this.namespace.metadata.name,
        },
        spec: {
          tokenSecret: {
            name: dopplerCmsToken.metadata.name,
          },
          managedSecret: {
            name: "doppler-cms",
          },
        },
      },
      {
        provider,
      }
    );

    this.configMap = new kubernetes.core.v1.ConfigMap(
      `${slugName}-environment`,
      {
        metadata: {
          namespace,
          name: "environment",
        },
        data: args.environment,
      },
      {
        provider,
        parent: this,
      }
    );

    this.operatorServiceAccount = new kubernetes.core.v1.ServiceAccount(
      `${slugName}-pulumi-operator-service-account`,
      {
        metadata: {
          namespace,
        },
      },
      {
        provider,
        parent: this,
      }
    );

    this.operatorRole = new kubernetes.rbac.v1.Role(
      `${slugName}-pulumi-operator-role`,
      {
        metadata: {
          namespace,
        },
        rules: [
          {
            apiGroups: ["*"],
            resources: ["*"],
            verbs: ["*"],
          },
        ],
      },
      {
        provider,
        parent: this,
      }
    );

    this.operatorRoleBinding = new kubernetes.rbac.v1.RoleBinding(
      `${slugName}-pulumi-operator-role-binding`,
      {
        metadata: {
          namespace,
        },
        subjects: [
          {
            kind: "ServiceAccount",
            name: this.operatorServiceAccount.metadata.name,
          },
        ],
        roleRef: {
          kind: "Role",
          name: this.operatorRole.metadata.name,
          apiGroup: "rbac.authorization.k8s.io",
        },
      },
      {
        provider,
        parent: this,
      }
    );

    const operatorName = `${slugName}-operator`;

    this.stackSecret = new RandomPassword(`${slugName}-pulumi-stack-secret`, {
      length: 32,
    });

    this.pulumiKubernetesSecret = new kubernetes.core.v1.Secret(
      `${slugName}-password`,
      {
        metadata: {
          namespace,
        },
        stringData: {
          password: this.stackSecret.result,
        },
      },
      {
        provider,
        parent: this,
      }
    );

    this.persistentVolumeClaim = new kubernetes.core.v1.PersistentVolumeClaim(
      `${slugName}-operator`,
      {
        metadata: {
          namespace,
        },
        spec: {
          accessModes: ["ReadWriteOnce"],
          resources: {
            requests: {
              storage: "10Gi",
            },
          },
        },
      },
      {
        provider,
        parent: this,
      }
    );

    this.operator = new kubernetes.apps.v1.Deployment(
      `${slugName}-pulumi-operator`,
      {
        metadata: {
          namespace,
        },
        spec: {
          replicas: 1,
          strategy: {
            type: "Recreate",
          },
          selector: {
            matchLabels: {
              name: operatorName,
            },
          },

          template: {
            metadata: {
              labels: {
                name: operatorName,
              },
            },
            spec: {
              serviceAccountName: this.operatorServiceAccount.metadata.name,
              volumes: [
                {
                  name: "state",
                  persistentVolumeClaim: {
                    claimName: this.persistentVolumeClaim.metadata.name,
                  },
                },
              ],
              securityContext: {
                fsGroup: 1000,
              },
              containers: [
                {
                  name: "operator",
                  image: "pulumi/pulumi-kubernetes-operator:v1.7.0",
                  args: ["--zap-level=error", "--zap-time-encoding=iso8601"],
                  imagePullPolicy: "Always",
                  volumeMounts: [
                    {
                      name: "state",
                      mountPath: "/state",
                    },
                  ],
                  envFrom: [
                    {
                      secretRef: {
                        name: `doppler-${slugName}`,
                      },
                    },
                  ],
                  env: [
                    {
                      name: "WATCH_NAMESPACE",
                      valueFrom: {
                        fieldRef: {
                          fieldPath: "metadata.namespace",
                        },
                      },
                    },
                    {
                      name: "POD_NAME",
                      valueFrom: {
                        fieldRef: {
                          fieldPath: "metadata.name",
                        },
                      },
                    },
                    {
                      name: "OPERATOR_NAME",
                      value: `${slugName}-operator`,
                    },
                    {
                      name: "GRACEFUL_SHUTDOWN_TIMEOUT_DURATION",
                      value: "5m",
                    },
                    {
                      name: "MAX_CONCURRENT_RECONCILES",
                      value: "1",
                    },
                    {
                      name: "PULUMI_INFER_NAMESPACE",
                      value: "1",
                    },
                  ],
                },
              ],
              // Should be same or larger than GRACEFUL_SHUTDOWN_TIMEOUT_DURATION
              terminationGracePeriodSeconds: 300,
            },
          },
        },
      },
      {
        provider,
        parent: this,
        dependsOn: [...args.platformDependency, this.operatorRoleBinding],
      }
    );

    this.stack = new kubernetes.apiextensions.CustomResource(
      `${slugName}-stack`,
      {
        apiVersion: "pulumi.com/v1",
        kind: "Stack",
        metadata: {
          namespace,
        },
        spec: {
          stack: slugName,
          projectRepo: args.repository,
          branch: "refs/heads/main",
          destroyOnFinalize: true,
          repoDir: args.directory,
          refresh: true,
          continueResyncOnCommitMatch: true,
          resyncFrequencySeconds: 60,
          backend: "file:///state",
          envRefs: {
            PULUMI_CONFIG_PASSPHRASE: {
              type: "Secret",
              secret: {
                namespace,
                name: this.pulumiKubernetesSecret.metadata.name,
                key: "password",
              },
            },
          },
        },
      },
      {
        provider,
        parent: this,
        dependsOn: [this.operator, this.configMap],
      }
    );

    this.registerOutputs({
      namespaceName: this.namespace.metadata.name,
      stackName: this.stack.metadata.name,
    });
  }

  public get stackName(): pulumi.Output<string> {
    return this.stack.metadata.name;
  }
}
