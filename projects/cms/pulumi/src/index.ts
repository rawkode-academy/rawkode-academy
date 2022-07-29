import * as random from "@pulumi/random";
import * as kubernetes from "@pulumi/kubernetes";
import * as atlas from "@pulumi/mongodbatlas";
import * as doppler from "@pulumiverse/doppler";

const orgId = process.env.MONGODB_ATLAS_ORG_ID!;

const project = new atlas.Project("cms", {
  orgId,
});

const configmap = new kubernetes.core.v1.ConfigMap("test", {
  data: {
    abc: "123",
  },
});

const database = new atlas.ServerlessInstance("cms", {
  projectId: project.id,
  providerSettingsProviderName: "SERVERLESS",
  providerSettingsBackingProviderName: "GCP",
  providerSettingsRegionName: "WESTERN_EUROPE",
});

const password = new random.RandomPassword("cms", {
  length: 31,
});

const user = new atlas.DatabaseUser("cms", {
  authDatabaseName: "admin",
  password: password.result,
  projectId: project.id,
  roles: [
    {
      databaseName: database.name,
      roleName: "readWrite",
    },
  ],
  scopes: [
    {
      name: database.name,
      type: "CLUSTER",
    },
  ],
  username: "cms",
});

const dopplerConnectionString = new doppler.Secret(
  "doppler-connection-string",
  {
    project: "cms",
    config: "production",
    name: "MONGODB_CONNECTION_STRING",
    value: database.connectionStringsStandardSrv,
  }
);

const dopplerPassword = new doppler.Secret("doppler-password", {
  project: "cms",
  config: "production",
  name: "MONGODB_PASSWORD",
  value: password.result,
});
