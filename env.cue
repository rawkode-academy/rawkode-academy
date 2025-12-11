package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Cuenv

env: {
	environment: production: {
		CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"

		// It's mostly me, @rawkode, that works on this project. As such,
		// this AAA/Root token is configured; but whenever we need to expose
		// commands or Cloudflare access to others, we will override this reference
		// per project.
		AAA_CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://Employee/w3etxulw37bsqb2rsna5px7y4u/api-tokens/all-access"
		}
		TF_WORKSPACE: "production"
	}
}

tasks: {
	"bun.install": {
		script: """
			set -e

			# Build projen generator dependencies first
			cd projects/rawkode.academy/generators/projen-platform-service
			bun install
			bun run types
			cd -

			# Generate projen files for platform services
			for service in email-preferences emoji-reactions video-likes; do
				SERVICE_DIR="projects/rawkode.academy/platform/$service"
				if [ -f "$SERVICE_DIR/.projenrc.ts" ]; then
					echo "Running projen for $service..."
					cd "$SERVICE_DIR"
					bun run .projenrc.ts
					cd -
				fi
			done

			# Generate projen files for game services
			for service in achievements leaderboard player-learned-phrases player-stats share-cards; do
				SERVICE_DIR="projects/rawkode.academy/games/secrets-of-kubernetes/$service"
				if [ -f "$SERVICE_DIR/.projenrc.ts" ]; then
					echo "Running projen for ski-$service..."
					cd "$SERVICE_DIR"
					bun run .projenrc.ts
					cd -
				fi
			done

			# Install all workspace dependencies after projen generates package.json files
			bun install
			"""
	}
}

