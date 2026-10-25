// The entity editor: a form built from the collection's field descriptors,
// its panels, revisions, delete and "View on site". Existing rows save a
// patch of changed fields with ifVersion; new rows POST their data.
import type { FieldDescriptor } from "@rawkodeacademy/content-write";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ApiError,
	api,
	type CollectionSummary,
	type EntityResponse,
	get,
	loadCollection,
	messageOf,
	type Row,
	type Versioned,
} from "./api-client";
import { type FieldContext, FieldInput } from "./fields";
import { useUnsavedWarning } from "./hooks";
import {
	AttachedPanelEditor,
	failureNotice,
	ListPanelEditor,
	type Notice,
	NoticeBanner,
} from "./Panels";
import { Revisions } from "./Revisions";
import {
	computePatch,
	createPayload,
	entityApiPath,
	entityPath,
	formatValue,
	hiddenCreateDefaults,
	initialDraft,
	isSlug,
	issuesByField,
	titleOf,
} from "./ui-helpers";

const SITE = "https://rawkode.academy";

export interface EntityEditorProps {
	collection: string;
	/** Undefined for a new row. */
	id?: string | undefined;
	isAdmin: boolean;
}

type Loaded =
	| { state: "loading" }
	| { state: "error"; message: string; status?: number }
	| {
			state: "ready";
			collection: CollectionSummary;
			entity: EntityResponse | null;
	  };

export function EntityEditor(props: EntityEditorProps) {
	const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
	const [generation, setGeneration] = useState(0);

	const load = useCallback(async () => {
		try {
			const collection = await loadCollection(props.collection);
			let entity: EntityResponse | null = null;
			if (props.id !== undefined) {
				entity = (
					await get<EntityResponse>(entityApiPath(props.collection, props.id))
				).data;
			}
			setLoaded({ state: "ready", collection, entity });
			setGeneration((g) => g + 1);
		} catch (error) {
			setLoaded({
				state: "error",
				message: messageOf(error),
				...(error instanceof ApiError ? { status: error.status } : {}),
			});
		}
	}, [props.collection, props.id]);

	useEffect(() => {
		load();
	}, [load]);

	if (loaded.state === "loading") return <p className="muted">Loading…</p>;
	if (loaded.state === "error") {
		return (
			<div className="notice notice--error" role="alert">
				<p>
					{loaded.status === 404 ? "Not found. " : ""}
					{loaded.message}
				</p>
				<a href={`/c/${encodeURIComponent(props.collection)}`}>
					Back to the list
				</a>
			</div>
		);
	}
	return (
		<EntityForm
			key={generation}
			collection={loaded.collection}
			entity={loaded.entity}
			id={props.id}
			isAdmin={props.isAdmin}
			reload={load}
		/>
	);
}

interface EntityFormProps {
	collection: CollectionSummary;
	entity: EntityResponse | null;
	id: string | undefined;
	isAdmin: boolean;
	reload: () => void;
}

function EntityForm(props: EntityFormProps) {
	const { collection, entity, id, isAdmin, reload } = props;
	const isNew = entity === null;
	const fields = useMemo<FieldDescriptor[]>(
		() => collection.fields.filter((f) => !collection.hidden.includes(f.name)),
		[collection],
	);
	const fieldNames = useMemo(() => fields.map((f) => f.name), [fields]);

	const [original, setOriginal] = useState<Row>(
		() => entity?.value ?? initialDraft(fields),
	);
	const [draft, setDraft] = useState<Row>(original);
	const [version, setVersion] = useState(entity?.version ?? 0);
	const [formKey, setFormKey] = useState(0);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [issues, setIssues] = useState<ApiError["issues"]>([]);
	const [invalid, setInvalid] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	const [panelDirty, setPanelDirty] = useState<Record<string, boolean>>({});
	const [deleteState, setDeleteState] = useState<
		| null
		| { kind: "busy" }
		| { kind: "error"; message: string; references: ApiError["references"] }
	>(null);

	const patch = computePatch(original, draft);
	const dirty = Object.keys(patch).length > 0;
	const anyDirty = dirty || Object.values(panelDirty).some(Boolean);
	const leave = useUnsavedWarning(anyDirty);

	const byField = issuesByField(issues);
	const knownFields = new Set(fieldNames);
	const otherIssues = Object.entries(byField)
		.filter(([field]) => !knownFields.has(field))
		.flatMap(([field, messages]) =>
			messages.map((m) => (field ? `${field}: ${m}` : m)),
		);

	const keyValue = draft[collection.key];
	const entityId = isNew
		? typeof keyValue === "string" && keyValue
			? keyValue
			: undefined
		: id;

	const context: FieldContext = {
		collection: collection.name,
		entityId,
		fieldNames,
		setField: (name, value) => setDraft((d) => ({ ...d, [name]: value })),
		setInvalid: (name, problem) =>
			setInvalid((current) => {
				const { [name]: _removed, ...rest } = current;
				return problem ? { ...rest, [name]: problem } : rest;
			}),
	};

	const onPanelDirty = useCallback(
		(panel: string, value: boolean) =>
			setPanelDirty((current) =>
				current[panel] === value ? current : { ...current, [panel]: value },
			),
		[],
	);

	const discard = () => {
		setDraft(original);
		setIssues([]);
		setInvalid({});
		setFormKey((k) => k + 1);
	};

	const save = async () => {
		setSaving(true);
		setNotice(null);
		setIssues([]);
		try {
			if (isNew) {
				const response = await api<Versioned<Row>>(
					"POST",
					`/collections/${encodeURIComponent(collection.name)}`,
					{
						data: {
							...hiddenCreateDefaults(collection.fields, collection.hidden),
							...createPayload(draft, fields),
						},
					},
				);
				if (response.status === 202) {
					const proposal = (
						response.data as unknown as { proposal: { id: string } }
					).proposal;
					setNotice({ kind: "proposed", id: proposal.id });
					setOriginal(draft);
					return;
				}
				const key = String(response.data.value[collection.key] ?? "");
				leave(entityPath(collection.name, key));
				return;
			}
			const response = await api<Versioned<Row>>(
				"PATCH",
				entityApiPath(collection.name, id ?? ""),
				{
					patch,
					ifVersion: version,
				},
			);
			if (response.status === 202) {
				const proposal = (
					response.data as unknown as { proposal: { id: string } }
				).proposal;
				setNotice({ kind: "proposed", id: proposal.id });
				// The change waits for review; the form shows the stored row again.
				setDraft(original);
				setFormKey((k) => k + 1);
				return;
			}
			setOriginal(response.data.value);
			setDraft(response.data.value);
			setVersion(response.data.version);
			setFormKey((k) => k + 1);
			setNotice({
				kind: "saved",
				message: `Saved as version ${response.data.version}`,
			});
		} catch (error) {
			const failed = failureNotice(error);
			setNotice(failed.notice);
			setIssues(failed.issues);
		} finally {
			setSaving(false);
		}
	};

	const remove = async () => {
		if (!id) return;
		const name = titleOf(original, collection.titleField, collection.key);
		if (
			!window.confirm(
				`Delete ${collection.singular.toLowerCase()} "${name}"? This cannot be undone here (admins can restore from revisions).`,
			)
		) {
			return;
		}
		setDeleteState({ kind: "busy" });
		try {
			await api(
				"DELETE",
				`${entityApiPath(collection.name, id)}?ifVersion=${version}`,
			);
			leave(`/c/${encodeURIComponent(collection.name)}`);
		} catch (error) {
			if (error instanceof ApiError && error.isConflict) {
				setDeleteState(null);
				setNotice({ kind: "conflict" });
				return;
			}
			setDeleteState({
				kind: "error",
				message: messageOf(error),
				references: error instanceof ApiError ? error.references : [],
			});
		}
	};

	const title = isNew
		? `New ${collection.singular.toLowerCase()}`
		: titleOf(original, collection.titleField, collection.key);
	// Bad JSON, and slugs this form would send that the write model would refuse.
	const badSlug = fields.some(
		(f) =>
			f.type === "slug" &&
			(isNew || f.name in patch) &&
			typeof draft[f.name] === "string" &&
			draft[f.name] !== "" &&
			!isSlug(String(draft[f.name])),
	);
	const blocked = Object.keys(invalid).length > 0 || badSlug;
	const canSave = (isNew || dirty) && !saving && !blocked;

	return (
		<div className="editor">
			<div className="editor__main">
				<nav className="crumbs" aria-label="Breadcrumb">
					<a href="/">CMS</a>
					<span aria-hidden="true">/</span>
					<a href={`/c/${encodeURIComponent(collection.name)}`}>
						{collection.label}
					</a>
					{!isNew && (
						<>
							<span aria-hidden="true">/</span>
							<span className="mono">{id}</span>
						</>
					)}
				</nav>
				<header className="editor__header">
					<div>
						<p className="mono-label">
							{collection.singular}
							{!isNew && ` · v${version}`}
							{dirty && " · unsaved changes"}
						</p>
						<h1 className="page-title">{title}</h1>
					</div>
					<div className="editor__actions">
						{entity?.websitePath && (
							<a
								className="button button--ghost button--sm"
								href={`${SITE}${entity.websitePath}`}
								target="_blank"
								rel="noreferrer"
							>
								View on site ↗
							</a>
						)}
						{isAdmin && !isNew && (
							<button
								type="button"
								className="button button--danger button--sm"
								disabled={deleteState?.kind === "busy"}
								onClick={remove}
							>
								{deleteState?.kind === "busy" ? "Deleting…" : "Delete"}
							</button>
						)}
					</div>
				</header>

				{deleteState?.kind === "error" && (
					<div className="notice notice--error" role="alert">
						<p>{deleteState.message}</p>
						{deleteState.references.length > 0 && (
							<ul className="references">
								{deleteState.references.map((ref) => (
									<li key={ref.label}>
										<strong>
											{ref.rows.length} {ref.label}
											{ref.rows.length === 1 ? "" : "s"}
										</strong>
										<ul>
											{ref.rows.slice(0, 20).map((row) => (
												<li key={JSON.stringify(row)} className="mono">
													{formatValue(row, 120)}
												</li>
											))}
										</ul>
									</li>
								))}
							</ul>
						)}
					</div>
				)}

				<form
					className="entity-form"
					onSubmit={(event) => {
						event.preventDefault();
						if (canSave) save();
					}}
					noValidate
				>
					<NoticeBanner notice={notice} onReload={reload} />
					{otherIssues.length > 0 && (
						<ul className="field__errors">
							{otherIssues.map((m) => (
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
								readOnly={!isNew && field.name === collection.key}
							/>
						))}
					</div>
					<div className="savebar">
						<span className="muted">
							{blocked
								? "Fix the highlighted fields to save."
								: dirty
									? `${Object.keys(patch).length} changed field${Object.keys(patch).length === 1 ? "" : "s"}`
									: isNew
										? ""
										: "No changes"}
						</span>
						<span className="spacer" />
						{dirty && !isNew && (
							<button
								type="button"
								className="button button--ghost"
								onClick={discard}
							>
								Discard
							</button>
						)}
						<button
							type="submit"
							className="button button--solid"
							disabled={!canSave}
						>
							{saving
								? "Saving…"
								: isNew
									? `Create ${collection.singular.toLowerCase()}`
									: "Save"}
						</button>
					</div>
				</form>

				{!isNew &&
					id !== undefined &&
					entity &&
					collection.panels.map((panel) => {
						const initial = entity.panels[panel.name] ?? {
							value: null,
							version: 0,
						};
						const Editor =
							panel.kind === "list" ? ListPanelEditor : AttachedPanelEditor;
						return (
							<Editor
								key={panel.name}
								collection={collection.name}
								entityId={id}
								panel={panel}
								initial={initial}
								onDirty={onPanelDirty}
								onReload={reload}
							/>
						);
					})}
			</div>
			{!isNew && id !== undefined && (
				<Revisions
					collection={collection.name}
					entityId={id}
					current={original}
					currentVersion={version}
					isAdmin={isAdmin}
					hidden={collection.hidden}
					onRestored={reload}
				/>
			)}
		</div>
	);
}
