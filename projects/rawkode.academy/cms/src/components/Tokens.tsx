// API tokens for agents (admins): create (the secret is shown once), list, revoke.
import { type SubmitEvent, useEffect, useState } from "react";
import { api, get, messageOf, type TokenRecord } from "./api-client";
import { formatTime } from "./ui-helpers";

const ROLES = [
	{
		value: "content_agent",
		label:
			"Agent: writes technologies, videos, people, shows; proposes the rest",
	},
	{ value: "content_admin", label: "Admin: writes everything" },
	{ value: "content_guest", label: "Guest: proposes edits to linked people" },
	{
		value: "content_partner",
		label: "Partner: proposes factual edits to linked technologies",
	},
] as const;

export function Tokens() {
	const [tokens, setTokens] = useState<TokenRecord[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [role, setRole] = useState<string>("content_agent");
	const [busy, setBusy] = useState(false);
	const [created, setCreated] = useState<{
		name: string;
		secret: string;
	} | null>(null);
	const [copied, setCopied] = useState(false);

	const load = () =>
		get<{ tokens: TokenRecord[] }>("/tokens")
			.then(({ data }) => setTokens(data.tokens))
			.catch((e) => setError(messageOf(e)));

	// biome-ignore lint/correctness/useExhaustiveDependencies: load once
	useEffect(() => {
		load();
	}, []);

	const create = async (event: SubmitEvent) => {
		event.preventDefault();
		if (!name.trim()) return;
		setBusy(true);
		setError(null);
		setCopied(false);
		try {
			const { data } = await api<{ id: string; secret: string }>(
				"POST",
				"/tokens",
				{
					name: name.trim(),
					role,
				},
			);
			setCreated({ name: name.trim(), secret: data.secret });
			setName("");
			load();
		} catch (e) {
			setError(messageOf(e));
		} finally {
			setBusy(false);
		}
	};

	const revoke = async (token: TokenRecord) => {
		if (
			!window.confirm(
				`Revoke "${token.name}"? Agents using it stop working immediately.`,
			)
		)
			return;
		try {
			await api("DELETE", `/tokens/${encodeURIComponent(token.id)}`);
			load();
		} catch (e) {
			setError(messageOf(e));
		}
	};

	const copy = async () => {
		if (!created) return;
		try {
			await navigator.clipboard.writeText(created.secret);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};

	return (
		<div className="settings">
			<header className="list__header">
				<div>
					<p className="mono-label">Settings</p>
					<h1 className="page-title">API tokens</h1>
				</div>
			</header>
			<p className="lede">
				Agents call <code>/api/v1</code> with{" "}
				<code>Authorization: Bearer cms_…</code>. Writes the role may not make
				directly become proposals.
			</p>
			{error && (
				<p className="notice notice--error" role="alert">
					{error}
				</p>
			)}
			{created && (
				<div className="secret" role="status">
					<p>
						<strong>Copy the token for “{created.name}” now.</strong> It is
						shown only once and cannot be recovered; revoke it and create
						another if it is lost.
					</p>
					<div className="secret__row">
						<label className="visually-hidden" htmlFor="token-secret">
							Token secret
						</label>
						<input
							id="token-secret"
							className="input input--mono"
							readOnly
							value={created.secret}
							onFocus={(e) => e.currentTarget.select()}
						/>
						<button
							type="button"
							className="button button--solid button--sm"
							onClick={copy}
						>
							{copied ? "Copied" : "Copy"}
						</button>
						<button
							type="button"
							className="button button--ghost button--sm"
							onClick={() => setCreated(null)}
						>
							Done
						</button>
					</div>
				</div>
			)}
			<form className="inline-form" onSubmit={create}>
				<div className="field">
					<label className="field__label" htmlFor="token-name">
						<span>Name</span>
						<span className="field__meta">who uses it</span>
					</label>
					<input
						id="token-name"
						className="input"
						required
						placeholder="news-agent"
						value={name}
						onChange={(e) => setName(e.currentTarget.value)}
					/>
				</div>
				<div className="field">
					<label className="field__label" htmlFor="token-role">
						<span>Role</span>
					</label>
					<select
						id="token-role"
						className="input input--select"
						value={role}
						onChange={(e) => setRole(e.currentTarget.value)}
					>
						{ROLES.map((r) => (
							<option key={r.value} value={r.value}>
								{r.value} — {r.label}
							</option>
						))}
					</select>
				</div>
				<button
					type="submit"
					className="button button--solid"
					disabled={busy || !name.trim()}
				>
					{busy ? "Creating…" : "Create token"}
				</button>
			</form>
			{tokens === null ? (
				<p className="muted">Loading…</p>
			) : tokens.length === 0 ? (
				<p className="empty">No tokens yet.</p>
			) : (
				<div className="table-scroll">
					<table className="table">
						<thead>
							<tr>
								<th scope="col">Name</th>
								<th scope="col">Role</th>
								<th scope="col">Created</th>
								<th scope="col">Last used</th>
								<th scope="col">Status</th>
								<th scope="col">
									<span className="visually-hidden">Actions</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{tokens.map((t) => (
								<tr
									key={t.id}
									className={t.revokedAt ? "row--muted" : undefined}
								>
									<td>
										{t.name} <span className="mono muted">{t.id}</span>
									</td>
									<td className="mono">{t.role}</td>
									<td className="mono muted">{formatTime(t.createdAt)}</td>
									<td className="mono muted">
										{t.lastUsedAt ? formatTime(t.lastUsedAt) : "never"}
									</td>
									<td>
										{t.revokedAt ? (
											`revoked ${formatTime(t.revokedAt)}`
										) : (
											<span className="tag tag--ok">active</span>
										)}
									</td>
									<td>
										{!t.revokedAt && (
											<button
												type="button"
												className="button button--danger button--sm"
												onClick={() => revoke(t)}
												aria-label={`Revoke ${t.name}`}
											>
												Revoke
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
