// Panels on the entity screen: list panels (guests, links, chapters) edited
// as tables and replaced together; attached panels (biography, episode) as a
// small form saved as one row.
import type { FieldDescriptor } from "@rawkodeacademy/content-write";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	ApiError,
	api,
	messageOf,
	type PanelSummary,
	type Row,
	type Versioned,
} from "./api-client";
import { type FieldContext, FieldInput, humanise } from "./fields";
import { Picker } from "./Picker";
import {
	computePatch,
	createPayload,
	deepEqual,
	entityApiPath,
	initialDraft,
	issuesByField,
	issuesByItem,
	move,
	pickFields,
	singularLabel,
} from "./ui-helpers";

export type Notice =
	| { kind: "saved"; message: string }
	| { kind: "proposed"; id: string }
	| { kind: "conflict" }
	| { kind: "error"; message: string };

export function NoticeBanner({
	notice,
	onReload,
}: {
	notice: Notice | null;
	onReload?: () => void;
}) {
	if (!notice) return null;
	switch (notice.kind) {
		case "saved":
			return (
				<p className="notice notice--ok" role="status">
					{notice.message}
				</p>
			);
		case "proposed":
			return (
				<p className="notice notice--info" role="status">
					Sent for review. An admin will approve or reject proposal{" "}
					<code>{notice.id}</code>. <a href="/proposals">View proposals</a>
				</p>
			);
		case "conflict":
			return (
				<div className="notice notice--warn" role="alert">
					<span>Someone changed this since you opened it.</span>
					{onReload && (
						<button
							type="button"
							className="button button--sm"
							onClick={onReload}
						>
							Reload
						</button>
					)}
				</div>
			);
		case "error":
			return (
				<p className="notice notice--error" role="alert">
					{notice.message}
				</p>
			);
	}
}

/** Maps a write failure to a notice (and field issues, when there are some). */
export function failureNotice(error: unknown): {
	notice: Notice;
	issues: ApiError["issues"];
} {
	if (error instanceof ApiError) {
		if (error.isConflict) return { notice: { kind: "conflict" }, issues: [] };
		if (error.status === 422) {
			return {
				notice: {
					kind: "error",
					message: error.message || "Some fields are invalid",
				},
				issues: error.issues,
			};
		}
		return { notice: { kind: "error", message: error.message }, issues: [] };
	}
	return { notice: { kind: "error", message: messageOf(error) }, issues: [] };
}

interface PanelProps {
	collection: string;
	entityId: string;
	panel: PanelSummary;
	initial: Versioned<Row[] | Row | null>;
	onDirty: (panel: string, dirty: boolean) => void;
	onReload: () => void;
}

// ----------------------------------------------------------------- list panel

interface Item {
	uid: number;
	value: Row;
}

let nextUid = 1;
const wrap = (rows: Row[], names: string[]): Item[] =>
	rows.map((row) => ({ uid: nextUid++, value: pickFields(row, names) }));

/** The editable item fields: the descriptor minus list bookkeeping columns. */
export const itemFields = (panel: PanelSummary): FieldDescriptor[] =>
	panel.fields.filter((f) => f.name !== "position");

export function ListPanelEditor(props: PanelProps) {
	const { collection, entityId, panel, onDirty, onReload } = props;
	const fields = useMemo(() => itemFields(panel), [panel]);
	const names = useMemo(() => fields.map((f) => f.name), [fields]);
	const initialRows = Array.isArray(props.initial.value)
		? props.initial.value
		: [];
	const [original, setOriginal] = useState<Row[]>(() =>
		initialRows.map((row) => pickFields(row, names)),
	);
	const [items, setItems] = useState<Item[]>(() => wrap(initialRows, names));
	const [version, setVersion] = useState(props.initial.version);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [issues, setIssues] = useState<ApiError["issues"]>([]);
	const [saving, setSaving] = useState(false);
	const [invalid, setInvalid] = useState<Record<string, string>>({});

	const values = items.map((i) => i.value);
	const dirty = !deepEqual(original, values);
	const onDirtyRef = useRef(onDirty);
	onDirtyRef.current = onDirty;
	useEffect(() => onDirtyRef.current(panel.name, dirty), [panel.name, dirty]);

	const grouped = issuesByItem(issues);
	const blocked = Object.keys(invalid).length > 0;

	const update = (uid: number, name: string, value: unknown) =>
		setItems((list) =>
			list.map((item) =>
				item.uid === uid
					? { ...item, value: { ...item.value, [name]: value } }
					: item,
			),
		);

	const save = async () => {
		setSaving(true);
		setNotice(null);
		setIssues([]);
		try {
			const response = await api<Versioned<Row[]>>(
				"PUT",
				`${entityApiPath(collection, entityId)}/panels/${encodeURIComponent(panel.name)}`,
				{ items: values, ifVersion: version },
			);
			if (response.status === 202) {
				const id = (response.data as unknown as { proposal: { id: string } })
					.proposal.id;
				setNotice({ kind: "proposed", id });
				setItems(wrap(original, names));
			} else {
				const saved = response.data.value.map((row) => pickFields(row, names));
				setOriginal(saved);
				setItems(wrap(saved, names));
				setVersion(response.data.version);
				setNotice({ kind: "saved", message: `${panel.label} saved` });
			}
		} catch (error) {
			const failed = failureNotice(error);
			setNotice(failed.notice);
			setIssues(failed.issues);
		} finally {
			setSaving(false);
		}
	};

	return (
		<section className="panel" aria-labelledby={`panel-${panel.name}`}>
			<header className="panel__header">
				<h2 id={`panel-${panel.name}`} className="panel__title">
					{panel.label}
				</h2>
				<span className="mono-label">
					{items.length} item{items.length === 1 ? "" : "s"} · v{version}
				</span>
			</header>
			<NoticeBanner notice={notice} onReload={onReload} />
			{grouped.general.length > 0 && (
				<ul className="field__errors">
					{grouped.general.map((m) => (
						<li key={m}>{m}</li>
					))}
				</ul>
			)}
			{items.length === 0 ? (
				<p className="empty">No {panel.label.toLowerCase()} yet.</p>
			) : (
				<div className="table-scroll">
					<table className="table table--edit">
						<thead>
							<tr>
								<th scope="col" className="table__index">
									#
								</th>
								{fields.map((f) => (
									<th key={f.name} scope="col">
										{humanise(f.name)}
										{f.required ? <span aria-hidden="true"> *</span> : null}
									</th>
								))}
								<th scope="col" className="table__actions">
									<span className="visually-hidden">Actions</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{items.map((item, index) => {
								const context: FieldContext = {
									collection,
									entityId,
									fieldNames: names,
									setField: (name, value) => update(item.uid, name, value),
									setInvalid: (name, problem) =>
										setInvalid((current) => {
											const key = `${item.uid}.${name}`;
											const { [key]: _removed, ...rest } = current;
											return problem ? { ...rest, [key]: problem } : rest;
										}),
								};
								const rowIssues = grouped.items[index] ?? {};
								return (
									<tr key={item.uid}>
										<td className="table__index mono">{index + 1}</td>
										{fields.map((field) => (
											<td key={field.name}>
												<FieldInput
													field={field}
													value={item.value[field.name]}
													onChange={(value) =>
														update(item.uid, field.name, value)
													}
													context={context}
													issues={rowIssues[field.name]}
													compact
													label={`${humanise(field.name)}, item ${index + 1}`}
												>
													{panel.picks?.field === field.name
														? ({ id, describedBy, invalid: bad }) => (
																<Picker
																	id={id}
																	collection={panel.picks?.collection ?? ""}
																	value={item.value[field.name]}
																	onChange={(value) =>
																		update(item.uid, field.name, value)
																	}
																	describedBy={describedBy}
																	invalid={bad}
																	label={`${humanise(field.name)}, item ${index + 1}`}
																/>
															)
														: undefined}
												</FieldInput>
											</td>
										))}
										<td className="table__actions">
											<div className="row-actions">
												<button
													type="button"
													className="icon-button"
													aria-label={`Move item ${index + 1} up`}
													disabled={index === 0}
													onClick={() =>
														setItems((list) => move(list, index, -1))
													}
												>
													↑
												</button>
												<button
													type="button"
													className="icon-button"
													aria-label={`Move item ${index + 1} down`}
													disabled={index === items.length - 1}
													onClick={() =>
														setItems((list) => move(list, index, 1))
													}
												>
													↓
												</button>
												<button
													type="button"
													className="icon-button icon-button--danger"
													aria-label={`Remove item ${index + 1}`}
													onClick={() =>
														setItems((list) =>
															list.filter((i) => i.uid !== item.uid),
														)
													}
												>
													×
												</button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
			<footer className="panel__footer">
				<button
					type="button"
					className="button button--outline button--sm"
					onClick={() =>
						setItems((list) => [
							...list,
							{ uid: nextUid++, value: initialDraft(fields) },
						])
					}
				>
					Add {singularLabel(panel.label)}
				</button>
				<span className="spacer" />
				{dirty && (
					<button
						type="button"
						className="button button--ghost button--sm"
						onClick={() => {
							setItems(wrap(original, names));
							setIssues([]);
						}}
					>
						Discard
					</button>
				)}
				<button
					type="button"
					className="button button--solid button--sm"
					disabled={!dirty || saving || blocked}
					onClick={save}
				>
					{saving ? "Saving…" : `Save ${panel.label.toLowerCase()}`}
				</button>
			</footer>
		</section>
	);
}

// ------------------------------------------------------------- attached panel

export function AttachedPanelEditor(props: PanelProps) {
	const { collection, entityId, panel, onDirty, onReload } = props;
	const fields = useMemo(
		() =>
			panel.fields.filter(
				(f) => f.name !== panel.keyField && f.name !== "updatedAt",
			),
		[panel],
	);
	const names = useMemo(() => fields.map((f) => f.name), [fields]);
	const initialValue =
		props.initial.value && !Array.isArray(props.initial.value)
			? props.initial.value
			: null;
	const [exists, setExists] = useState(initialValue !== null);
	const [original, setOriginal] = useState<Row>(() =>
		initialValue ? pickFields(initialValue, names) : initialDraft(fields),
	);
	const [draft, setDraft] = useState<Row>(original);
	const [version, setVersion] = useState(props.initial.version);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [issues, setIssues] = useState<ApiError["issues"]>([]);
	const [saving, setSaving] = useState(false);
	const [invalid, setInvalid] = useState<Record<string, string>>({});
	const [formKey, setFormKey] = useState(0);

	const patch = computePatch(original, draft);
	const dirty = Object.keys(patch).length > 0;
	const onDirtyRef = useRef(onDirty);
	onDirtyRef.current = onDirty;
	useEffect(() => onDirtyRef.current(panel.name, dirty), [panel.name, dirty]);
	const byField = issuesByField(issues);

	const context: FieldContext = {
		collection,
		entityId,
		fieldNames: names,
		setField: (name, value) => setDraft((d) => ({ ...d, [name]: value })),
		setInvalid: (name, problem) =>
			setInvalid((current) => {
				const { [name]: _removed, ...rest } = current;
				return problem ? { ...rest, [name]: problem } : rest;
			}),
	};

	const save = async () => {
		setSaving(true);
		setNotice(null);
		setIssues([]);
		try {
			const data = exists ? patch : createPayload(draft, fields);
			const response = await api<Versioned<Row>>(
				"PUT",
				`${entityApiPath(collection, entityId)}/panels/${encodeURIComponent(panel.name)}`,
				{ data, ifVersion: version },
			);
			if (response.status === 202) {
				const id = (response.data as unknown as { proposal: { id: string } })
					.proposal.id;
				setNotice({ kind: "proposed", id });
				setDraft(original);
				setFormKey((k) => k + 1);
			} else {
				const saved = pickFields(response.data.value, names);
				setOriginal(saved);
				setDraft(saved);
				setVersion(response.data.version);
				setExists(true);
				setFormKey((k) => k + 1);
				setNotice({ kind: "saved", message: `${panel.label} saved` });
			}
		} catch (error) {
			const failed = failureNotice(error);
			setNotice(failed.notice);
			setIssues(failed.issues);
		} finally {
			setSaving(false);
		}
	};

	return (
		<section className="panel" aria-labelledby={`panel-${panel.name}`}>
			<header className="panel__header">
				<h2 id={`panel-${panel.name}`} className="panel__title">
					{panel.label}
				</h2>
				<span className="mono-label">
					{exists ? `v${version}` : "not created yet"}
				</span>
			</header>
			<NoticeBanner notice={notice} onReload={onReload} />
			{byField[""] && (
				<ul className="field__errors">
					{byField[""].map((m) => (
						<li key={m}>{m}</li>
					))}
				</ul>
			)}
			<div className="form-grid" key={formKey}>
				{fields.map((field) => (
					<FieldInput
						key={field.name}
						field={field}
						value={draft[field.name]}
						onChange={(value) =>
							setDraft((d) => ({ ...d, [field.name]: value }))
						}
						context={context}
						issues={byField[field.name]}
					/>
				))}
			</div>
			<footer className="panel__footer">
				<span className="spacer" />
				{dirty && (
					<button
						type="button"
						className="button button--ghost button--sm"
						onClick={() => {
							setDraft(original);
							setIssues([]);
							setFormKey((k) => k + 1);
						}}
					>
						Discard
					</button>
				)}
				<button
					type="button"
					className="button button--solid button--sm"
					disabled={!dirty || saving || Object.keys(invalid).length > 0}
					onClick={save}
				>
					{saving
						? "Saving…"
						: exists
							? `Save ${panel.label.toLowerCase()}`
							: `Create ${panel.label.toLowerCase()}`}
				</button>
			</footer>
		</section>
	);
}
