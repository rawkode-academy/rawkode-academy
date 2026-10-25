// A typeahead for relationship fields (a guest's person id, a technology id):
// searches the picked collection and stores the row's key, showing its title.
import { type KeyboardEvent, useEffect, useId, useState } from "react";
import {
	type CollectionSummary,
	get,
	loadCollection,
	messageOf,
	type Row,
} from "./api-client";
import { useDebounced } from "./hooks";
import { titleOf } from "./ui-helpers";

interface Option {
	key: string;
	title: string;
}

const titles = new Map<string, string>();
const cacheKey = (collection: string, key: string) =>
	`${collection}\u0000${key}`;

async function search(
	collection: CollectionSummary,
	term: string,
	signal: AbortSignal,
): Promise<Option[]> {
	const params = new URLSearchParams({ search: term, limit: "10" });
	const { data } = await get<{ rows: Row[] }>(
		`/collections/${encodeURIComponent(collection.name)}?${params}`,
		{ signal },
	);
	return data.rows.map((row) => {
		const key = String(row[collection.key] ?? "");
		const title = titleOf(row, collection.titleField, collection.key);
		titles.set(cacheKey(collection.name, key), title);
		return { key, title };
	});
}

export interface PickerProps {
	id: string;
	collection: string;
	value: unknown;
	onChange: (value: string | null) => void;
	describedBy: string | undefined;
	invalid: boolean;
	readOnly?: boolean;
	label: string;
}

export function Picker(props: PickerProps) {
	const { id, value, onChange, describedBy, invalid, readOnly, label } = props;
	const listId = useId();
	const current = typeof value === "string" ? value : "";
	const [collection, setCollection] = useState<CollectionSummary | null>(null);
	const [title, setTitle] = useState<string | null>(null);
	const [text, setText] = useState("");
	const [editing, setEditing] = useState(false);
	const [options, setOptions] = useState<Option[]>([]);
	const [active, setActive] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const term = useDebounced(text, 200);

	useEffect(() => {
		loadCollection(props.collection)
			.then(setCollection)
			.catch((e) => setError(messageOf(e)));
	}, [props.collection]);

	// The title of the stored key: from the cache, or a search for the key.
	useEffect(() => {
		if (!collection || !current) {
			setTitle(null);
			return;
		}
		const cached = titles.get(cacheKey(collection.name, current));
		if (cached) {
			setTitle(cached);
			return;
		}
		const controller = new AbortController();
		search(collection, current, controller.signal)
			.then(() =>
				setTitle(titles.get(cacheKey(collection.name, current)) ?? null),
			)
			.catch(() => setTitle(null));
		return () => controller.abort();
	}, [collection, current]);

	useEffect(() => {
		if (!collection || !editing) return;
		const controller = new AbortController();
		search(collection, term, controller.signal)
			.then((found) => {
				setOptions(found);
				setActive(0);
				setError(null);
			})
			.catch((e) => {
				if (!controller.signal.aborted) setError(messageOf(e));
			});
		return () => controller.abort();
	}, [collection, term, editing]);

	const choose = (option: Option) => {
		onChange(option.key);
		setTitle(option.title);
		setText("");
		setEditing(false);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setEditing(true);
			setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActive((i) => Math.max(i - 1, 0));
		} else if (event.key === "Enter") {
			const option = options[active];
			if (editing && option) {
				event.preventDefault();
				choose(option);
			}
		} else if (event.key === "Escape") {
			setEditing(false);
			setText("");
		}
	};

	const open = editing && options.length > 0;
	const display = editing
		? text
		: current
			? title
				? `${title}`
				: current
			: "";

	return (
		<div className="picker">
			<input
				id={id}
				type="text"
				role="combobox"
				className="input"
				autoComplete="off"
				aria-label={label}
				aria-autocomplete="list"
				aria-expanded={open}
				aria-controls={listId}
				aria-activedescendant={open ? `${listId}-${active}` : undefined}
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
				readOnly={readOnly}
				placeholder={
					collection ? `Search ${collection.label.toLowerCase()}…` : "Search…"
				}
				value={display}
				onFocus={() => {
					if (readOnly) return;
					setEditing(true);
					setText("");
				}}
				onBlur={() => setTimeout(() => setEditing(false), 150)}
				onChange={(event) => {
					setEditing(true);
					setText(event.currentTarget.value);
				}}
				onKeyDown={onKeyDown}
			/>
			{current && !editing && <span className="picker__key">{current}</span>}
			<div id={listId} role="listbox" className="picker__list" hidden={!open}>
				{options.map((option, index) => (
					<div
						key={option.key}
						id={`${listId}-${index}`}
						role="option"
						tabIndex={-1}
						aria-selected={index === active}
						className={`picker__option${index === active ? " picker__option--active" : ""}`}
						onMouseDown={(event) => {
							event.preventDefault();
							choose(option);
						}}
					>
						<span>{option.title}</span>
						<span className="picker__key">{option.key}</span>
					</div>
				))}
			</div>
			{error && <p className="field__errors">{error}</p>}
		</div>
	);
}
