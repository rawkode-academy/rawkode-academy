package comtrya

instance: {
	id:          "code-rawkode-academy"
	name:        "Rawkode Academy Code"
	publicURL:   "https://code.rawkode.academy"
	environment: "production"
	allowedOrigins: ["https://code.rawkode.academy"]
}

database: {
	kind: "sqlite"
	url:  "sqlite:///app/data/metadata/comtrya.db"
}

oidc: issuers: [{
	id:          "rawkode"
	issuerURL:   "https://id.rawkode.academy"
	clientID:    "comtrya"
	clientKind:  "public"
	redirectURL: "https://code.rawkode.academy/auth/oidc/rawkode/callback"
	allowed: {
		domains: ["rawkode.academy"]
		groups:  ["admin", "maintainer"]
	}
}]

storage: repositories: {
	default: "local"
	backends: local: {
		kind: "local"
		path: "/app/data/repositories"
	}
}

authz: kind: "spicedb"

workspaces: default: {
	name:       "Rawkode Academy"
	visibility: "PRIVATE"
}
