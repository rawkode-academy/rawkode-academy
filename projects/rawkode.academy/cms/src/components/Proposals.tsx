// Pending proposals. Admins review each against the current row (or list)
// and approve or reject it; others see their own proposals waiting.
import { useEffect, useState } from "react";
import {
	ApiError,
	api,
	type EntityResponse,
	get,
	messageOf,
	type Proposal,
	type Row,
	type Versioned,
} from "./api-client";
import { humanise } from "./fields";
import { DiffTable } from "./Revisions";
import {
	diffLists,
	diffRows,
	entityApiPath,
	entityPath,
	formatTime,
	formatValue,
	type ListChange,
} from "./ui-helpers";

export function Proposals({ isAdmin }: { isAdmin: boolean }) {
	const [proposals, setProposals] = useState<Proposal[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [open, setOpen] = useState<string | null>(null);

	const load = () =>
		get<{ proposals: Proposal[] }>("/proposals")
			.then(({ data }) => {
				setProposals(data.proposals);
				setError(null);
			})
			.catch((e) => setError(messageOf(e)));

	// biome-ignore lint/correctness/useExhaustiveDependencies: load once
	useEffect(() => {
		load();
	}, []);

	return (
		<div className="proposals">
			<header className="list__header">
				<div>
					<p className="mono-label">
						{isAdmin ? "Review queue" : "Your proposals"}
					</p>
					<h1 className="page-title">Proposals</h1>
				</div>
			</header>
			{error && (
				<p className="notice notice--error" role="alert">
					{error}
				</p>
			)}
			{proposals === null && !error && <p className="muted">Loading…</p>}
			{proposals?.length === 0 && (
				<p className="empty">Nothing waiting for review.</p>
			)}
			<ul className="proposal-list">
				{(proposals ?? []).map((p) => (
					<li key={p.id} className="proposal">
						<button
							type="button"
							className="proposal__summary"
							aria-expanded={open === p.id}
							aria-controls={`proposal-${p.id}`}
							onClick={() => setOpen(open === p.id ? null : p.id)}
						>
							<span className="tag">{describeKind(p)}</span>
							<span className="proposal__target">
								{p.collection}
								{p.entityId ? (
									<span className="mono"> / {p.entityId}</span>
								) : null}
							</span>
							<span className="muted">by {p.author.name ?? p.author.id}</span>
							<time className="mono muted">{formatTime(p.createdAt)}</time>
						</button>
						{open === p.id && (
							<div id={`proposal-${p.id}`}>
								<ProposalReview
									id={p.id}
									isAdmin={isAdmin}
									onDecided={() => {
										setOpen(null);
										load();
									}}
								/>
							</div>
						)}
					</li>
				))}
			</ul>
		</div>
	);
}

function describeKind(p: Proposal): string {
	switch (p.kind) {
		case "create":
			return "new row";
		case "update":
			return "edit";
		case "list":
			return `${p.list ?? "list"}`;
		case "attached":
			return `${p.list ?? "attached"}`;
	}
}

interface Review {
	proposal: Proposal;
	current: Versioned<Row> | null;
	/** For list and attached proposals: the current panel value. */
	panel: Versioned<Row[] | Row | null> | null;
}

function ProposalReview({
	id,
	isAdmin,
	onDecided,
}: {
	id: string;
	isAdmin: boolean;
	onDecided: () => void;
}) {
	const [review, setReview] = useState<Review | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [conflict, setConflict] = useState<string | null>(null);
	const [note, setNote] = useState("");
	const [rejecting, setRejecting] = useState(false);

	useEffect(() => {
		(async () => {
			try {
				const { data } = await get<{
					proposal: Proposal;
					current: Versioned<Row> | null;
				}>(`/proposals/${encodeURIComponent(id)}`);
				let panel: Review["panel"] = null;
				const { proposal } = data;
				if (
					(proposal.kind === "list" || proposal.kind === "attached") &&
					proposal.entityId &&
					proposal.list
				) {
					try {
						const entity = await get<EntityResponse>(
							entityApiPath(proposal.collection, proposal.entityId),
						);
						panel = entity.data.panels[proposal.list] ?? null;
					} catch {
						panel = null;
					}
				}
				setReview({ proposal, current: data.current, panel });
			} catch (e) {
				setError(messageOf(e));
			}
		})();
	}, [id]);

	const approve = async (force: boolean) => {
		setBusy(true);
		setError(null);
		try {
			await api(
				"POST",
				`/proposals/${encodeURIComponent(id)}/approve`,
				force ? { force: true } : {},
			);
			onDecided();
		} catch (e) {
			if (e instanceof ApiError && e.isConflict) {
				setConflict(e.message);
			} else {
				setError(
					e instanceof ApiError && e.issues.length
						? `${e.message}: ${e.issues.map((i) => `${i.path} ${i.message}`).join("; ")}`
						: messageOf(e),
				);
			}
		} finally {
			setBusy(false);
		}
	};

	const reject = async () => {
		setBusy(true);
		setError(null);
		try {
			await api(
				"POST",
				`/proposals/${encodeURIComponent(id)}/reject`,
				note.trim() ? { note: note.trim() } : {},
			);
			onDecided();
		} catch (e) {
			setError(messageOf(e));
		} finally {
			setBusy(false);
		}
	};

	if (error && !review) {
		return (
			<p className="notice notice--error" role="alert">
				{error}
			</p>
		);
	}
	if (!review) return <p className="muted proposal__body">Loading…</p>;
	const { proposal, current, panel } = review;

	return (
		<div className="proposal__body">
			<p className="mono-label">
				Based on version {proposal.baseVersion}
				{current ? ` · current version ${current.version}` : ""}
				{current &&
				proposal.kind === "update" &&
				current.version !== proposal.baseVersion
					? " · the row changed since this was proposed"
					: ""}
			</p>
			<ProposalDiff proposal={proposal} current={current} panel={panel} />
			{proposal.entityId && (
				<p>
					<a href={entityPath(proposal.collection, proposal.entityId)}>
						Open the row
					</a>
				</p>
			)}
			{error && (
				<p className="notice notice--error" role="alert">
					{error}
				</p>
			)}
			{conflict && (
				<div className="notice notice--warn" role="alert">
					<span>
						The row changed since this was proposed ({conflict}). Approving
						anyway applies the proposal over the newer version.
					</span>
					<button
						type="button"
						className="button button--sm"
						disabled={busy}
						onClick={() => approve(true)}
					>
						Approve anyway
					</button>
				</div>
			)}
			{isAdmin && (
				<div className="proposal__actions">
					{rejecting ? (
						<div className="reject">
							<label className="field__label" htmlFor={`note-${id}`}>
								<span>Note for the author</span>
								<span className="field__meta">optional</span>
							</label>
							<textarea
								id={`note-${id}`}
								className="input input--textarea"
								rows={2}
								value={note}
								onChange={(e) => setNote(e.currentTarget.value)}
							/>
							<div className="row-actions">
								<button
									type="button"
									className="button button--ghost button--sm"
									onClick={() => setRejecting(false)}
								>
									Cancel
								</button>
								<button
									type="button"
									className="button button--danger button--sm"
									disabled={busy}
									onClick={reject}
								>
									Reject
								</button>
							</div>
						</div>
					) : (
						<div className="row-actions">
							<button
								type="button"
								className="button button--outline button--sm"
								onClick={() => setRejecting(true)}
							>
								Reject…
							</button>
							<button
								type="button"
								className="button button--solid button--sm"
								disabled={busy}
								onClick={() => approve(false)}
							>
								{busy ? "Working…" : "Approve"}
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function ProposalDiff({
	proposal,
	current,
	panel,
}: {
	proposal: Proposal;
	current: Versioned<Row> | null;
	panel: Versioned<Row[] | Row | null> | null;
}) {
	const payload = proposal.payload;
	if (proposal.kind === "create") {
		const data = (payload.data ?? {}) as Row;
		return (
			<DiffTable
				changes={diffRows({}, data)}
				beforeLabel=""
				afterLabel="Proposed"
			/>
		);
	}
	if (proposal.kind === "update") {
		const patch = (payload.patch ?? {}) as Row;
		const changes = Object.keys(patch).map((field) => ({
			field,
			before: current?.value[field],
			after: patch[field],
		}));
		return (
			<DiffTable
				changes={changes}
				beforeLabel="Current"
				afterLabel="Proposed"
			/>
		);
	}
	if (proposal.kind === "attached") {
		const data = (payload.data ?? {}) as Row;
		const existing =
			panel?.value && !Array.isArray(panel.value) ? panel.value : {};
		const changes = Object.keys(data).map((field) => ({
			field,
			before: existing[field],
			after: data[field],
		}));
		return (
			<DiffTable
				changes={changes}
				beforeLabel="Current"
				afterLabel="Proposed"
			/>
		);
	}
	const items = Array.isArray(payload.items) ? (payload.items as Row[]) : [];
	const itemKeys = new Set(items.flatMap((item) => Object.keys(item)));
	const existing = Array.isArray(panel?.value)
		? panel.value.map((row) =>
				Object.fromEntries(
					Object.entries(row).filter(([k]) => itemKeys.has(k)),
				),
			)
		: [];
	return <ListDiff changes={diffLists(existing, items)} total={items.length} />;
}

function ListDiff({
	changes,
	total,
}: {
	changes: ListChange[];
	total: number;
}) {
	if (changes.length === 0)
		return <p className="muted">Same as the current list ({total} items).</p>;
	return (
		<div>
			<p className="mono-label">Proposed list: {total} items</p>
			<ul className="list-diff">
				{changes.map((change) => (
					<li
						key={`${change.kind}-${change.index}`}
						className={`list-diff__${change.kind}`}
					>
						<span className="mono">#{change.index + 1}</span>{" "}
						{change.kind === "changed" ? (
							<span>
								{change.changes
									.map(
										(c) =>
											`${humanise(c.field)}: ${formatValue(c.before, 60)} → ${formatValue(c.after, 60)}`,
									)
									.join("; ")}
							</span>
						) : (
							<span>
								{change.kind === "added" ? "added " : "removed "}
								<span className="mono">{formatValue(change.item, 120)}</span>
							</span>
						)}
					</li>
				))}
			</ul>
		</div>
	);
}
