// Copies the root Cloudflare token from 1Password to Infisical, for CI. cuenv
// can't pass a secret into a resource, so infrastructure.cue can't do this. Run
// it after the first apply, which creates the /infrastructure folder, and again
// after rotating the token.

const API = "https://app.infisical.com/api";
const SECRET = "CLOUDFLARE_ROOT_TOKEN";

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}

const login = await fetch(`${API}/v1/auth/universal-auth/login`, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		clientId: required("INFISICAL_CLIENT_ID"),
		clientSecret: required("INFISICAL_CLIENT_SECRET"),
	}),
});
if (!login.ok) throw new Error(`Infisical login returned HTTP ${login.status}`);
const { accessToken } = (await login.json()) as { accessToken: string };

const send = (method: "PATCH" | "POST") =>
	fetch(`${API}/v4/secrets/${SECRET}`, {
		method,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			projectId: "6575a392d7a5ef0555ade86b",
			environment: "production",
			secretPath: "/infrastructure",
			type: "shared",
			secretValue: required(SECRET),
		}),
	});

const updated = await send("PATCH");
const response = updated.ok ? updated : await send("POST");
if (!response.ok) throw new Error(`Infisical returned HTTP ${response.status}`);
console.log(`Copied ${SECRET} to /infrastructure`);
