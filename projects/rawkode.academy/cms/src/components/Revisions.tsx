// Revision history for an entity: who changed it and when, a field-level diff
// of any revision against the current row, and restore (admins).
import { useEffect, useState } from "react";
import { api, get, messageOf, type Revision, type Row } from "./api-client";
import { humanise } from "./fields";
import { diffRows, entityApiPath, formatTime, formatValue } from "./ui-helpers";

export interface RevisionsProps {
	collection: string;
	entityId: string;
	current: Row;
	currentVersion: number;
	isAdmin: boolean;
	hidden: string[];
	onRestored: () => void;
}

export function Revisions(props: RevisionsProps) {
	const {
		collection,
		entityId,
		current,
		currentVersion,
		isAdmin,
		hidden,
		onRestored,
	} = props;
	const [revisions, setRevisions] = useState<Revision[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [selected, setSelected] = useState<number | null>(null);
	const [restoring, setRestoring] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reload when the row's version moves
	useEffect(() => {
		const controller = new AbortController();
		get<{ revisions: Revision[] }>(
			`${entityApiPath(collection, entityId)}/revisions`,
			{
				signal: controller.signal,
			},
		)
			.then(({ data }) => {
				setRevisions(data.revisions);
				setError(null);
			})
			.catch((e) => {
				if (!controller.signal.aborted) setError(messageOf(e));
			});
		return () => controller.abort();
	}, [collection, entityId, currentVersion]);

	const revision = revisions?.find((r) => r.version === selected) ?? null;
	const snapshot =
		revision &&
		typeof revision.snapshot === "object" &&
		revision.snapshot !== null
			? (revision.snapshot as Row)
			: null;
	const changes = snapshot
		? diffRows(snapshot, current, { ignore: hidden })
		: [];

	const restore = async () => {
		if (!revision) return;
		if (
			!window.confirm(
				`Restore version ${revision.version}? This creates a new version.`,
			)
		)
			return;
		setRestoring(true);
		try {
			await api("POST", `${entityApiPath(collection, entityId)}/restore`, {
				version: revision.version,
			});
			setSelected(null);
			onRestored();
		} catch (e) {
			setError(messageOf(e));
		} finally {
			setRestoring(false);
		}
	};

	return (
		<aside className="revisions" aria-labelledby="revisions-title">
			<h2 id="revisions-title" className="mono-label">
				Revisions
			</h2>
			{error && (
				<p className="notice notice--error" role="alert">
					{error}
				</p>
			)}
			{revisions === null && !error && <p className="muted">Loading…</p>}
			{revisions?.length === 0 && (
				<p className="muted">No revisions yet: this row predates the CMS.</p>
			)}
			{revisions && revisions.length > 0 && (
				<ol className="revisions__list">
					{revisions.map((r) => (
						<li key={r.version}>
							<button
								type="button"
								className={`revision${selected === r.version ? " revision--active" : ""}`}
								aria-pressed={selected === r.version}
								onClick={() =>
									setSelected(selected === r.version ? null : r.version)
								}
							>
								<span className="revision__version mono">v{r.version}</span>
								<span className="revision__op">{r.operation}</span>
								<span className="revision__who">
									{r.actor.name ?? r.actor.id}
								</span>
								<time className="revision__when mono">
									{formatTime(r.createdAt)}
								</time>
							</button>
						</li>
					))}
				</ol>
			)}
			{revision && (
				<div className="revision-diff">
					<h3 className="revision-diff__title">
						v{revision.version} → current (v{currentVersion})
					</h3>
					{!snapshot ? (
						<p className="muted">This revision has no snapshot.</p>
					) : changes.length === 0 ? (
						<p className="muted">Same as the current row.</p>
					) : (
						<DiffTable
							changes={changes}
							beforeLabel={`v${revision.version}`}
							afterLabel="Current"
						/>
					)}
					{isAdmin &&
						snapshot &&
						revision.version !== currentVersion &&
						revision.operation !== "delete" && (
							<button
								type="button"
								className="button button--outline button--sm"
								disabled={restoring}
								onClick={restore}
							>
								{restoring ? "Restoring…" : "Restore this version"}
							</button>
						)}
				</div>
			)}
		</aside>
	);
}

export function DiffTable({
	changes,
	beforeLabel = "Before",
	afterLabel = "After",
}: {
	changes: { field: string; before: unknown; after: unknown }[];
	beforeLabel?: string;
	afterLabel?: string;
}) {
	return (
		<div className="table-scroll">
			<table className="table table--diff">
				<thead>
					<tr>
						<th scope="col">Field</th>
						<th scope="col">{beforeLabel}</th>
						<th scope="col">{afterLabel}</th>
					</tr>
				</thead>
				<tbody>
					{changes.map((change) => (
						<tr key={change.field}>
							<th scope="row">{humanise(change.field)}</th>
							<td className="diff diff--before">
								{formatValue(change.before)}
							</td>
							<td className="diff diff--after">{formatValue(change.after)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
