// A collection's rows: debounced search, paging, title and key per row.
import { useEffect, useState } from "react";
import {
	type CollectionSummary,
	get,
	loadCollection,
	messageOf,
	type Row,
} from "./api-client";
import { useDebounced } from "./hooks";
import { entityPath, formatTime, titleOf } from "./ui-helpers";

const PAGE = 50;

export interface CollectionListProps {
	collection: string;
	/** From the page URL, so server and client render the same first frame. */
	initialSearch?: string;
	/** Zero-based. */
	initialPage?: number;
}

export function CollectionList({
	collection: name,
	initialSearch = "",
	initialPage = 0,
}: CollectionListProps) {
	const [collection, setCollection] = useState<CollectionSummary | null>(null);
	const [search, setSearch] = useState(initialSearch);
	const [page, setPage] = useState(initialPage);
	const [rows, setRows] = useState<Row[] | null>(null);
	const [total, setTotal] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const term = useDebounced(search.trim(), 300);

	useEffect(() => {
		loadCollection(name)
			.then(setCollection)
			.catch((e) => setError(messageOf(e)));
	}, [name]);

	// Keep search and page in the URL so the back button returns to them.
	useEffect(() => {
		const params = new URLSearchParams();
		if (term) params.set("search", term);
		if (page > 0) params.set("page", String(page + 1));
		const query = params.toString();
		window.history.replaceState(
			null,
			"",
			`${window.location.pathname}${query ? `?${query}` : ""}`,
		);
	}, [term, page]);

	useEffect(() => {
		if (!collection) return;
		const controller = new AbortController();
		const params = new URLSearchParams({
			limit: String(PAGE),
			offset: String(page * PAGE),
		});
		if (term) params.set("search", term);
		setLoading(true);
		get<{ rows: Row[]; total: number }>(
			`/collections/${encodeURIComponent(collection.name)}?${params}`,
			{ signal: controller.signal },
		)
			.then(({ data }) => {
				setRows(data.rows);
				setTotal(data.total);
				setError(null);
			})
			.catch((e) => {
				if (!controller.signal.aborted) setError(messageOf(e));
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [collection, term, page]);

	if (error && !collection) {
		return (
			<p className="notice notice--error" role="alert">
				{error}
			</p>
		);
	}
	if (!collection) return <p className="muted">Loading…</p>;

	const pages = Math.max(1, Math.ceil(total / PAGE));
	const canCreate =
		collection.create === "write" || collection.create === "propose";
	const showUpdated = collection.fields.some((f) => f.name === "updatedAt");

	return (
		<div className="list">
			<header className="list__header">
				<div>
					<p className="mono-label">Collection</p>
					<h1 className="page-title">{collection.label}</h1>
				</div>
				{canCreate && (
					<a
						className="button button--solid"
						href={`/c/${encodeURIComponent(collection.name)}/new`}
					>
						New {collection.singular.toLowerCase()}
						{collection.create === "propose" ? " (for review)" : ""}
					</a>
				)}
			</header>
			<div className="list__tools">
				<label className="visually-hidden" htmlFor="list-search">
					Search {collection.label.toLowerCase()}
				</label>
				<input
					id="list-search"
					type="search"
					className="input"
					placeholder={`Search ${collection.label.toLowerCase()}…`}
					value={search}
					onChange={(event) => {
						setSearch(event.currentTarget.value);
						setPage(0);
					}}
				/>
				<span className="mono-label" aria-live="polite">
					{loading ? "Loading…" : `${total} ${total === 1 ? "row" : "rows"}`}
				</span>
			</div>
			{error && (
				<p className="notice notice--error" role="alert">
					{error}
				</p>
			)}
			{rows && rows.length === 0 ? (
				<p className="empty">
					{term ? `Nothing matches "${term}".` : "Nothing here yet."}
				</p>
			) : (
				<div className="table-scroll">
					<table className="table table--rows">
						<thead>
							<tr>
								<th scope="col">Title</th>
								<th scope="col">Key</th>
								{showUpdated && <th scope="col">Updated</th>}
							</tr>
						</thead>
						<tbody>
							{(rows ?? []).map((row) => {
								const key = String(row[collection.key] ?? "");
								return (
									<tr key={key}>
										<td>
											<a
												className="row-link"
												href={entityPath(collection.name, key)}
											>
												{titleOf(row, collection.titleField, collection.key)}
											</a>
										</td>
										<td className="mono muted">{key}</td>
										{showUpdated && (
											<td className="mono muted">
												{formatTime(row.updatedAt)}
											</td>
										)}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
			{pages > 1 && (
				<nav className="pager" aria-label="Pages">
					<button
						type="button"
						className="button button--outline button--sm"
						disabled={page === 0}
						onClick={() => setPage((p) => Math.max(0, p - 1))}
					>
						← Previous
					</button>
					<span className="mono-label">
						Page {page + 1} of {pages}
					</span>
					<button
						type="button"
						className="button button--outline button--sm"
						disabled={page >= pages - 1}
						onClick={() => setPage((p) => p + 1)}
					>
						Next →
					</button>
				</nav>
			)}
		</div>
	);
}
