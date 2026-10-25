// The home screen: every collection the user can open, pending proposals and,
// for admins, recent activity.
import { useEffect, useState } from "react";
import {
	type ActivityEntry,
	type CollectionSummary,
	get,
	loadCollections,
	messageOf,
	type Proposal,
} from "./api-client";
import { entityPath, formatTime } from "./ui-helpers";

export function Dashboard({ isAdmin }: { isAdmin: boolean }) {
	const [collections, setCollections] = useState<CollectionSummary[] | null>(
		null,
	);
	const [pending, setPending] = useState<number | null>(null);
	const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadCollections()
			.then(setCollections)
			.catch((e) => setError(messageOf(e)));
		get<{ proposals: Proposal[] }>("/proposals")
			.then(({ data }) => setPending(data.proposals.length))
			.catch(() => setPending(null));
		if (isAdmin) {
			get<{ activity: ActivityEntry[] }>("/activity")
				.then(({ data }) => setActivity(data.activity))
				.catch(() => setActivity([]));
		}
	}, [isAdmin]);

	return (
		<div className="dashboard">
			<header className="list__header">
				<div>
					<p className="mono-label">Rawkode Academy</p>
					<h1 className="page-title">Content</h1>
				</div>
				<a
					className={`stat${pending ? " stat--attention" : ""}`}
					href="/proposals"
				>
					<span className="stat__number">{pending ?? "–"}</span>
					<span className="mono-label">
						{isAdmin ? "pending proposals" : "of your proposals pending"}
					</span>
				</a>
			</header>
			{error && (
				<p className="notice notice--error" role="alert">
					{error}
				</p>
			)}
			<section aria-labelledby="collections-title">
				<h2 id="collections-title" className="section-title">
					Collections
				</h2>
				{collections === null && !error ? (
					<p className="muted">Loading…</p>
				) : collections?.length === 0 ? (
					<p className="empty">Your account cannot open any collections yet.</p>
				) : (
					<ul className="tiles">
						{(collections ?? []).map((c) => (
							<li key={c.name}>
								<a className="tile" href={`/c/${encodeURIComponent(c.name)}`}>
									<span className="tile__title">{c.label}</span>
									<span className="mono-label">
										{c.create === "write"
											? "edit"
											: c.create === "propose"
												? "propose"
												: "view"}
										{c.panels.length
											? ` · ${c.panels.map((p) => p.label.toLowerCase()).join(", ")}`
											: ""}
									</span>
								</a>
							</li>
						))}
					</ul>
				)}
			</section>
			{isAdmin && (
				<section aria-labelledby="activity-title">
					<h2 id="activity-title" className="section-title">
						Recent activity
					</h2>
					{activity === null ? (
						<p className="muted">Loading…</p>
					) : activity.length === 0 ? (
						<p className="empty">No changes yet.</p>
					) : (
						<div className="table-scroll">
							<table className="table">
								<thead>
									<tr>
										<th scope="col">When</th>
										<th scope="col">Who</th>
										<th scope="col">What</th>
										<th scope="col">Row</th>
									</tr>
								</thead>
								<tbody>
									{activity.slice(0, 30).map((a) => (
										<tr
											key={`${a.at}-${a.actor_id}-${a.collection}-${a.entity_id}-${a.operation}`}
										>
											<td className="mono muted">{formatTime(a.at)}</td>
											<td>{a.actor_name ?? a.actor_id}</td>
											<td>
												{a.operation}
												{a.version !== null ? (
													<span className="muted mono"> v{a.version}</span>
												) : null}
											</td>
											<td className="mono">
												{a.operation === "delete" || a.entity_id === "(new)" ? (
													`${a.collection}/${a.entity_id}`
												) : (
													<a href={entityPath(a.collection, a.entity_id)}>
														{a.collection}/{a.entity_id}
													</a>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>
			)}
		</div>
	);
}
