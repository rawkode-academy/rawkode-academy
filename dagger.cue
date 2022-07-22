package build

import (
	"dagger.io/dagger"
	"github.com/RawkodeAcademy/RawkodeAcademy/platform"
)

globalConfig: {
	cloudflare:
		accountId: "0aeb879de8e3cdde5fb3d413025222ce"
	mongodb: atlas: {
		publicKey: "bvjadywy"
	}
	scaleway: {
		projectId: "7afd6a47-8805-4a55-8a0e-e029a45b28fd"
	}
}

dagger.#Plan & {
	client: env: DOPPLER_TOKEN: dagger.#Secret

	actions: build: "platform": platform.#Build & {
		config: doppler: token: client.env.DOPPLER_TOKEN
	}
}

// dagger.#Plan & {
//  client: env: SOPS_AGE_KEY: dagger.#Secret

//  client: commands: sops: {
//   name: "sops"
//   env: SOPS_AGE_KEY: client.env.SOPS_AGE_KEY
//   args: ["-d", "secrets.yaml"]
//   stdout: dagger.#Secret
//  }

//  actions: {
//   secrets: core.#DecodeSecret & {
//    input:  client.commands.sops.stdout
//    format: "yaml"
//   }

//   build: {
//    // This returns a kubeconfig property for other builds
//    pla: platform.#Build & {
//     config: {
//      pulumi: {
//       accessToken: secrets.output.pulumi.apiToken.contents
//      }
//      scaleway: {
//       projectId: globalConfig.scaleway.projectId
//       accessKey: secrets.output.scaleway.accessKey.contents
//       secretKey: secrets.output.scaleway.secretKey.contents
//      }
//     }
//    }

//    "cms": cms.#Build & {
//     config: {
//      github: token: secrets.output.github.token.contents
//      mongodb: atlas: {
//       publicKey:  globalConfig.mongodb.atlas.publicKey
//       privateKey: secrets.output.mongodb.atlas.privateKey.contents
//      }
//      platform: kubeconfig: secrets.output.pulumi.apiToken.contents
//      pulumi: accessToken:  secrets.output.pulumi.apiToken.contents
//     }
//    }

//    domainsDns: (domains_dns & {
//     config: {
//      cloudflare: {
//       accountId: globalConfig.cloudflare.accountId
//       apiToken:  secrets.output.cloudflare.apiToken.contents
//      }
//      pulumi: {
//       accessToken: secrets.output.pulumi.apiToken.contents
//      }
//     }
//    }).build

//    "webLinks": weblinks.#Build & {
//     config: {
//      cloudflare: {
//       accountId: globalConfig.cloudflare.accountId
//       apiToken:  secrets.output.cloudflare.apiToken.contents
//      }
//      rudderStack: {
//       basicAuth: secrets.output.rudderStack.basicAuth.contents
//      }
//     }
//    }

//    "website": website.#Build & {
//     config: {
//      cloudflare: {
//       accountId: globalConfig.cloudflare.accountId
//       apiToken:  secrets.output.cloudflare.apiToken.contents
//      }
//     }
//    }
//   }
//  }
// }
