import * as kubernetes from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

const kubernetesProvider = new kubernetes.Provider("kubernetes", {
  enableServerSideApply: true,
});

const password = new random.RandomPassword("cms", {
  length: 32,
});

const payloadCmsSecretKey = new random.RandomPassword("payloadcms-secret", {
  length: 64,
});

const cmsServerSecret = new kubernetes.core.v1.Secret(
  "cms-server",
  {
    data: {
      password: password.result.apply((result) =>
        Buffer.from(result).toString("base64")
      ),
      payloadSecret: payloadCmsSecretKey.result.apply((result) =>
        Buffer.from(result).toString("base64")
      ),
    },
  },
  {
    provider: kubernetesProvider,
  }
);

const mongoDbRbac = new kubernetes.yaml.ConfigGroup(
  "mongodb-rbac",
  {
    files: [
      "https://raw.githubusercontent.com/mongodb/mongodb-kubernetes-operator/v0.7.6/config/rbac/role.yaml",
      "https://raw.githubusercontent.com/mongodb/mongodb-kubernetes-operator/v0.7.6/config/rbac/role_binding.yaml",
      "https://raw.githubusercontent.com/mongodb/mongodb-kubernetes-operator/v0.7.6/config/rbac/role_binding_database.yaml",
      "https://raw.githubusercontent.com/mongodb/mongodb-kubernetes-operator/v0.7.6/config/rbac/role_database.yaml",
      "https://raw.githubusercontent.com/mongodb/mongodb-kubernetes-operator/v0.7.6/config/rbac/service_account.yaml",
      "https://raw.githubusercontent.com/mongodb/mongodb-kubernetes-operator/v0.7.6/config/rbac/service_account_database.yaml",
    ],
  },
  {
    provider: kubernetesProvider,
  }
);

const mongoDbDeployment = new kubernetes.apiextensions.CustomResource(
  "cms-server-mongodb",
  {
    apiVersion: "mongodbcommunity.mongodb.com/v1",
    kind: "MongoDBCommunity",
    metadata: {
      annotations: {
        "pulumi.com/skipAwait": "true",
      },
    },
    spec: {
      members: 3,
      type: "ReplicaSet",
      version: "4.4.6",
      security: {
        authentication: {
          modes: ["SCRAM"],
        },
      },
      users: [
        {
          name: "cms",
          db: "admin",
          passwordSecretRef: {
            name: cmsServerSecret.metadata.name,
          },
          roles: [
            {
              name: "clusterAdmin",
              db: "admin",
            },
            {
              name: "userAdminAnyDatabase",
              db: "admin",
            },
          ],
          scramCredentialsSecretName: "cms-server",
        },
      ],
      additionalMongodConfig: {
        "storage.wiredTiger.engineConfig.journalCompressor": "zlib",
      },
    },
  },
  {
    provider: kubernetesProvider,
  }
);

const payloadCmsDeployment = new kubernetes.apps.v1.Deployment(
  "payloadcms",
  {
    spec: {
      selector: {
        matchLabels: {
          app: "payloadcms",
        },
      },
      template: {
        metadata: {
          labels: {
            app: "payloadcms",
          },
        },
        spec: {
          containers: [
            {
              name: "payloadcms",
              image: "ghcr.io/rawkodeacademy/cms-server:latest",
              imagePullPolicy: "Always",
              env: [
                {
                  name: "PAYLOAD_SECRET",
                  valueFrom: {
                    secretKeyRef: {
                      name: cmsServerSecret.metadata.name,
                      key: "payloadSecret",
                    },
                  },
                },
                {
                  name: "MONGODB_URI",
                  value: "mongodb://mongodb",
                },
                {
                  name: "MONGODB_USERNAME",
                  value: "cms",
                },
                {
                  name: "MONGODB_PASSWORD",
                  valueFrom: {
                    secretKeyRef: {
                      name: cmsServerSecret.metadata.name,
                      key: "password",
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    },
  },
  {
    deleteBeforeReplace: true,
    provider: kubernetesProvider,
  }
);
