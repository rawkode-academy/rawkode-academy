// Access links (admins): which person or technology a guest or partner may
// propose edits to, keyed by their identity user id.
import { type SubmitEvent, useEffect, useState } from "react";
import { type AccessLink, api, get, messageOf } from "./api-client";
import { Picker } from "./Picker";
import { entityPath, formatTime } from "./ui-helpers";

export function AccessLinks() {
	const [links, setLinks] = useState<AccessLink[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [userId, setUserId] = useState("");
	const [kind, setKind] = useState<"person" | "technology">("person");
	const [targetId, setTargetId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const load = () =>
		get<{ links: AccessLink[] }>("/access")
			.then(({ data }) => setLinks(data.links))
			.catch((e) => setError(messageOf(e)));

	// biome-ignore lint/correctness/useExhaustiveDependencies: load once
	useEffect(() => {
		load();
	}, []);

	const add = async (event: SubmitEvent) => {
		event.preventDefault();
		if (!userId.trim() || !targetId) return;
		setBusy(true);
		setError(null);
		try {
			await api("POST", "/access", { userId: userId.trim(), kind, targetId });
			setUserId("");
			setTargetId(null);
			load();
		} catch (e) {
			setError(messageOf(e));
		} finally {
			setBusy(false);
		}
	};

	const remove = async (link: AccessLink) => {
		if (
			!window.confirm(
				`Remove ${link.user_id}'s access to ${link.kind} ${link.target_id}?`,
			)
		)
			return;
		try {
			await api(
				"DELETE",
				`/access/${encodeURIComponent(link.user_id)}/${link.kind}/${encodeURIComponent(link.target_id)}`,
			);
			load();
		} catch (e) {
			setError(messageOf(e));
		}
	};

	return (
		<div className="settings">
			<header className="list__header">
				<div>
					<p className="mono-label">Settings</p>
					<h1 className="page-title">Access links</h1>
				</div>
			</header>
			<p className="lede">
				Guests (<code>content_guest</code>) may propose edits to their linked
				person; partners (<code>content_partner</code>) to the factual fields of
				their linked technology. The user id is the <code>sub</code> from
				id.rawkode.academy.
			</p>
			{error && (
				<p className="notice notice--error" role="alert">
					{error}
				</p>
			)}
			<form className="inline-form" onSubmit={add}>
				<div className="field">
					<label className="field__label" htmlFor="access-user">
						<span>User id</span>
					</label>
					<input
						id="access-user"
						className="input input--mono"
						required
						value={userId}
						onChange={(e) => setUserId(e.currentTarget.value)}
					/>
				</div>
				<div className="field">
					<label className="field__label" htmlFor="access-kind">
						<span>Kind</span>
					</label>
					<select
						id="access-kind"
						className="input input--select"
						value={kind}
						onChange={(e) => {
							setKind(e.currentTarget.value as "person" | "technology");
							setTargetId(null);
						}}
					>
						<option value="person">person</option>
						<option value="technology">technology</option>
					</select>
				</div>
				<div className="field field--wide">
					<label className="field__label" htmlFor="access-target">
						<span>{kind === "person" ? "Person" : "Technology"}</span>
					</label>
					<Picker
						key={kind}
						id="access-target"
						collection={kind === "person" ? "people" : "technologies"}
						value={targetId}
						onChange={setTargetId}
						describedBy={undefined}
						invalid={false}
						label={kind === "person" ? "Person" : "Technology"}
					/>
				</div>
				<button
					type="submit"
					className="button button--solid"
					disabled={busy || !userId.trim() || !targetId}
				>
					{busy ? "Linking…" : "Link"}
				</button>
			</form>
			{links === null ? (
				<p className="muted">Loading…</p>
			) : links.length === 0 ? (
				<p className="empty">No access links yet.</p>
			) : (
				<div className="table-scroll">
					<table className="table">
						<thead>
							<tr>
								<th scope="col">User</th>
								<th scope="col">Kind</th>
								<th scope="col">Target</th>
								<th scope="col">Linked</th>
								<th scope="col">
									<span className="visually-hidden">Actions</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{links.map((link) => (
								<tr key={`${link.user_id}-${link.kind}-${link.target_id}`}>
									<td className="mono">{link.user_id}</td>
									<td>{link.kind}</td>
									<td className="mono">
										<a
											href={entityPath(
												link.kind === "person" ? "people" : "technologies",
												link.target_id,
											)}
										>
											{link.target_id}
										</a>
									</td>
									<td className="mono muted">
										{formatTime(link.created_at)} · {link.created_by}
									</td>
									<td>
										<button
											type="button"
											className="button button--danger button--sm"
											aria-label={`Remove ${link.user_id}'s access to ${link.target_id}`}
											onClick={() => remove(link)}
										>
											Remove
										</button>
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
