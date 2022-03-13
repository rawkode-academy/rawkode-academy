import * as kubernetes from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

export const deployStack = (
  project: string
): kubernetes.apiextensions.CustomResource => {
  const stackSecret = new random.RandomPassword(
    `${project}-pulumi-stack-secret`,
    {
      length: 32,
    }
  );

  const kubernetesSecret = new kubernetes.core.v1.Secret(
    `${project}-password`,
    {
      stringData: {
        password: stackSecret.result,
      },
    }
  );

  return new kubernetes.apiextensions.CustomResource(`${project}-stack`, {
    apiVersion: "pulumi.com/v1",
    kind: "Stack",
    spec: {
      stack: project,
      projectRepo: "https://github.com/rawkode-academy/rawkode-academy",
      branch: "refs/heads/main",
      repoDir: `projects/${project}/deploy`,
      destroyOnFinalize: true,
      backend: "file:///state",
      envRefs: {
        PULUMI_CONFIG_PASSPHRASE: {
          type: "Secret",
          secret: {
            name: kubernetesSecret.metadata.name,
            key: "password",
          },
        },
      },
    },
  });
};
