// One form input per field descriptor type. The entity editor, list panels
// and attached panels all render fields through FieldInput.
import type { FieldDescriptor } from "@rawkodeacademy/content-write";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { messageOf, uploadMedia } from "./api-client";
import { RichTextEditor } from "./RichTextEditor";
import {
	dimensionFields,
	emptyValue,
	fromDateTimeLocal,
	isLongText,
	isSlug,
	isUploadField,
	parseJson,
	stringifyJson,
	toDateTimeLocal,
} from "./ui-helpers";

export interface FieldContext {
	/** The collection uploads are filed under. */
	collection: string;
	/** The entity id uploads are filed under; undefined until the row has one. */
	entityId: string | undefined;
	/** Every field name on the form, for width/height companions. */
	fieldNames: string[];
	/** Sets another field (upload dimensions). */
	setField: (name: string, value: unknown) => void;
	/** Reports a client-side problem (bad JSON, bad slug) that blocks saving. */
	setInvalid: (name: string, problem: string | null) => void;
}

export interface FieldInputProps {
	field: FieldDescriptor;
	value: unknown;
	onChange: (value: unknown) => void;
	context: FieldContext;
	issues?: string[] | undefined;
	readOnly?: boolean;
	/** Compact table-cell rendering: label visually hidden, no help text. */
	compact?: boolean;
	/** Overrides the label (defaults to a humanised field name). */
	label?: string;
	/** Replaces the default input (relationship pickers). */
	children?: (props: {
		id: string;
		describedBy: string | undefined;
		invalid: boolean;
	}) => React.ReactNode;
}

/** "coverUrl" → "Cover url", "learning_path" → "Learning path". */
export function humanise(name: string): string {
	const words = name
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim()
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function typeHint(field: FieldDescriptor): string {
	switch (field.type) {
		case "slug":
			return "kebab-case";
		case "strings":
			return "list";
		case "rich-text":
			return "rich text";
		default:
			return field.type;
	}
}

export function FieldInput(props: FieldInputProps) {
	const {
		field,
		value,
		issues = [],
		readOnly = false,
		compact = false,
		context,
	} = props;
	const id = useId();
	const [local, setLocal] = useState<string | null>(null);
	const problem = localProblem(field, value) ?? local;
	const messages = problem ? [problem, ...issues] : issues;
	const invalid = messages.length > 0;
	const errorId = `${id}-errors`;
	const describedBy = invalid ? errorId : undefined;
	const label = props.label ?? humanise(field.name);

	const reportLocal = (message: string | null) => {
		setLocal(message);
		context.setInvalid(field.name, message);
	};

	let input: React.ReactNode;
	if (props.children) {
		input = props.children({ id, describedBy, invalid });
	} else {
		input = (
			<Control
				{...props}
				id={id}
				describedBy={describedBy}
				invalid={invalid}
				readOnly={readOnly}
				reportLocal={reportLocal}
			/>
		);
	}

	const isGroup =
		field.type === "boolean" || (field.type === "strings" && field.options);
	return (
		<div
			className={`field field--${field.type}${compact ? " field--compact" : ""}${
				invalid ? " field--invalid" : ""
			}`}
		>
			{field.type === "boolean" ? null : isGroup ? null : (
				<label
					id={`${id}-label`}
					className={compact ? "visually-hidden" : "field__label"}
					htmlFor={field.type === "rich-text" ? undefined : id}
				>
					<span>{label}</span>
					{!compact && (
						<span className="field__meta">
							{typeHint(field)}
							{field.required ? " · required" : ""}
						</span>
					)}
				</label>
			)}
			{field.type === "strings" && field.options ? (
				<fieldset className="field__group" aria-describedby={describedBy}>
					<legend className={compact ? "visually-hidden" : "field__label"}>
						<span>{label}</span>
						{!compact && <span className="field__meta">choose any</span>}
					</legend>
					{input}
				</fieldset>
			) : field.type === "boolean" ? (
				<label className="field__check" htmlFor={id}>
					{input}
					<span className={compact ? "visually-hidden" : undefined}>
						{label}
					</span>
				</label>
			) : (
				input
			)}
			{invalid && (
				<ul className="field__errors" id={errorId}>
					{messages.map((message) => (
						<li key={message}>{message}</li>
					))}
				</ul>
			)}
		</div>
	);
}

/** Problems visible from the value alone (no server round trip). */
function localProblem(field: FieldDescriptor, value: unknown): string | null {
	if (
		field.type === "slug" &&
		typeof value === "string" &&
		value !== "" &&
		!isSlug(value)
	) {
		return "Use a kebab-case slug: lowercase letters, digits and single hyphens";
	}
	return null;
}

interface ControlProps extends FieldInputProps {
	id: string;
	describedBy: string | undefined;
	invalid: boolean;
	readOnly: boolean;
	reportLocal: (message: string | null) => void;
}

function Control(props: ControlProps) {
	const { field, value, onChange, id, describedBy, invalid, readOnly } = props;
	const common = {
		id,
		"aria-describedby": describedBy,
		"aria-invalid": invalid || undefined,
		"aria-required": field.required || undefined,
		readOnly,
	};
	const setText = (text: string) =>
		onChange(text === "" ? emptyValue(field) : text);

	switch (field.type) {
		case "boolean":
			return (
				<input
					{...common}
					type="checkbox"
					checked={value === true}
					disabled={readOnly}
					onChange={(event) => onChange(event.currentTarget.checked)}
				/>
			);
		case "number":
			return (
				<input
					{...common}
					type="number"
					step="any"
					inputMode="decimal"
					className="input input--number"
					value={typeof value === "number" ? String(value) : ""}
					onChange={(event) => {
						const text = event.currentTarget.value;
						if (text === "") onChange(emptyValue(field) ?? null);
						else if (Number.isFinite(Number(text))) onChange(Number(text));
					}}
				/>
			);
		case "date":
			return (
				<input
					{...common}
					type="datetime-local"
					step={1}
					className="input"
					value={toDateTimeLocal(value)}
					onChange={(event) =>
						onChange(fromDateTimeLocal(event.currentTarget.value))
					}
				/>
			);
		case "enum":
			return (
				<select
					{...common}
					disabled={readOnly}
					className="input input--select"
					value={typeof value === "string" ? value : ""}
					onChange={(event) => {
						const next = event.currentTarget.value;
						onChange(next === "" ? (field.nullable ? null : undefined) : next);
					}}
				>
					{field.required ? (
						<option value="" disabled>
							Choose…
						</option>
					) : (
						<option value="">(none)</option>
					)}
					{(field.options ?? []).map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
			);
		case "strings":
			return field.options ? (
				<OptionsInput {...props} />
			) : (
				<ChipInput {...props} />
			);
		case "json":
			return <JsonInput {...props} />;
		case "rich-text":
			return (
				<RichTextEditor
					id={id}
					value={value}
					onChange={(doc) =>
						onChange(doc ?? (field.nullable ? null : undefined))
					}
					readOnly={readOnly}
					describedBy={describedBy}
					collection={props.context.collection}
					entityId={props.context.entityId}
				/>
			);
		case "url":
			return <UrlInput {...props} />;
		case "slug":
			return (
				<input
					{...common}
					type="text"
					className="input input--mono"
					spellCheck={false}
					autoCapitalize="off"
					pattern="[a-z0-9]+(-[a-z0-9]+)*"
					value={typeof value === "string" ? value : ""}
					onChange={(event) => setText(event.currentTarget.value)}
				/>
			);
		default: {
			const text =
				typeof value === "string" ? value : value == null ? "" : String(value);
			if (!props.compact && isLongText(field.name, text)) {
				return (
					<textarea
						{...common}
						className="input input--textarea"
						rows={Math.min(14, Math.max(3, text.split("\n").length + 1))}
						value={text}
						onChange={(event) => setText(event.currentTarget.value)}
					/>
				);
			}
			return (
				<input
					{...common}
					type="text"
					className="input"
					value={text}
					onChange={(event) => setText(event.currentTarget.value)}
				/>
			);
		}
	}
}

function UrlInput(props: ControlProps) {
	const {
		field,
		value,
		onChange,
		id,
		describedBy,
		invalid,
		readOnly,
		context,
	} = props;
	const fileRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const upload = isUploadField(field.name) && !readOnly;
	const canUpload = upload && !!context.entityId;

	const onFile = async (file: File | undefined) => {
		if (!file || !context.entityId) return;
		setBusy(true);
		setError(null);
		try {
			const result = await uploadMedia(
				file,
				context.collection,
				context.entityId,
			);
			onChange(result.url);
			const companions = dimensionFields(field.name, context.fieldNames);
			if (companions.width && typeof result.width === "number") {
				context.setField(companions.width, result.width);
			}
			if (companions.height && typeof result.height === "number") {
				context.setField(companions.height, result.height);
			}
		} catch (e) {
			setError(messageOf(e));
		} finally {
			setBusy(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	return (
		<div className="url-input">
			<div className="url-input__row">
				<input
					id={id}
					type="url"
					className="input input--mono"
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					readOnly={readOnly}
					spellCheck={false}
					value={typeof value === "string" ? value : ""}
					onChange={(event) => {
						const text = event.currentTarget.value;
						onChange(text === "" ? emptyValue(field) : text);
					}}
				/>
				{upload && (
					<>
						<input
							ref={fileRef}
							type="file"
							accept="image/*,application/pdf"
							className="visually-hidden"
							tabIndex={-1}
							aria-hidden="true"
							onChange={(event) => onFile(event.currentTarget.files?.[0])}
						/>
						<button
							type="button"
							className="button button--outline button--sm"
							disabled={!canUpload || busy}
							title={
								canUpload
									? undefined
									: "Save the row (or set its id) before uploading"
							}
							onClick={() => fileRef.current?.click()}
						>
							{busy ? "Uploading…" : "Upload"}
						</button>
					</>
				)}
			</div>
			{typeof value === "string" &&
				/\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(value) && (
					<img
						className="url-input__preview"
						src={value}
						alt=""
						loading="lazy"
					/>
				)}
			{error && (
				<p className="field__errors" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}

function OptionsInput(props: ControlProps) {
	const { field, value, onChange, readOnly } = props;
	const selected = Array.isArray(value) ? (value as string[]) : [];
	return (
		<div className="options">
			{(field.options ?? []).map((option) => (
				<label key={option} className="field__check">
					<input
						type="checkbox"
						disabled={readOnly}
						checked={selected.includes(option)}
						onChange={(event) => {
							const next = event.currentTarget.checked
								? [...selected, option]
								: selected.filter((s) => s !== option);
							onChange(next.length || !field.nullable ? next : null);
						}}
					/>
					<span>{option}</span>
				</label>
			))}
		</div>
	);
}

/** A tag input: Enter or comma adds, Backspace on empty removes the last. */
function ChipInput(props: ControlProps) {
	const { field, value, onChange, id, describedBy, invalid, readOnly } = props;
	const items = Array.isArray(value) ? (value as unknown[]).map(String) : [];
	const [text, setText] = useState("");

	const commit = (raw: string) => {
		const additions = raw
			.split(/[,\n]/)
			.map((s) => s.trim())
			.filter((s) => s && !items.includes(s));
		if (additions.length) onChange([...items, ...additions]);
		setText("");
	};
	const remove = (index: number) => {
		const next = items.filter((_, i) => i !== index);
		onChange(next.length || !field.nullable ? next : null);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			commit(text);
		} else if (event.key === "Backspace" && text === "" && items.length) {
			remove(items.length - 1);
		}
	};

	return (
		<div className={`chips${invalid ? " chips--invalid" : ""}`}>
			<ul className="chips__list" aria-label={`${humanise(field.name)} items`}>
				{items.map((item, index) => (
					// Stored lists may repeat a value, so the index disambiguates; chips hold no state.
					// biome-ignore lint/suspicious/noArrayIndexKey: see above
					<li key={`${item}-${index}`} className="chip">
						<span>{item}</span>
						{!readOnly && (
							<button
								type="button"
								className="chip__remove"
								aria-label={`Remove ${item}`}
								onClick={() => remove(index)}
							>
								×
							</button>
						)}
					</li>
				))}
			</ul>
			{!readOnly && (
				<input
					id={id}
					type="text"
					className="chips__input"
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					placeholder={items.length ? "Add another…" : "Type and press Enter"}
					value={text}
					onChange={(event) => setText(event.currentTarget.value)}
					onKeyDown={onKeyDown}
					onBlur={() => text.trim() && commit(text)}
				/>
			)}
		</div>
	);
}

function JsonInput(props: ControlProps) {
	const { value, onChange, id, describedBy, invalid, readOnly, reportLocal } =
		props;
	const [text, setText] = useState(() => stringifyJson(value));
	return (
		<textarea
			id={id}
			className="input input--textarea input--mono"
			aria-describedby={describedBy}
			aria-invalid={invalid || undefined}
			readOnly={readOnly}
			spellCheck={false}
			rows={Math.min(18, Math.max(3, text.split("\n").length + 1))}
			value={text}
			onChange={(event) => {
				const next = event.currentTarget.value;
				setText(next);
				const parsed = parseJson(next);
				if (parsed.ok) {
					reportLocal(null);
					onChange(
						parsed.value === null
							? (emptyValue(props.field) ?? null)
							: parsed.value,
					);
				} else {
					reportLocal(`Invalid JSON: ${parsed.error}`);
				}
			}}
		/>
	);
}
