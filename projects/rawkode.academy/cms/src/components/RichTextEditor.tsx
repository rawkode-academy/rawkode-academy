// The rich-text field: TipTap over exactly the stored document schema
// (@rawkodeacademy/rich-text/schema), so documents round-trip losslessly.
// Atom nodes (diagram, video, interactive, embed) are shown as labelled blocks
// and kept as they are. The schema has no history extension, so there is no
// undo/redo button (adding one would change what the editor is built from).
import { extensions } from "@rawkodeacademy/rich-text/schema";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useRef, useState } from "react";
import { messageOf, uploadMedia } from "./api-client";

export interface RichTextEditorProps {
	id: string;
	/** The stored document (TipTap JSON) or null. */
	value: unknown;
	/** Called with the document after each edit, or null when it is emptied. */
	onChange: (doc: unknown) => void;
	readOnly?: boolean;
	describedBy?: string | undefined;
	collection: string;
	entityId: string | undefined;
}

const isDoc = (value: unknown) =>
	typeof value === "object" &&
	value !== null &&
	(value as { type?: unknown }).type === "doc";

export function RichTextEditor(props: RichTextEditorProps) {
	const {
		id,
		value,
		onChange,
		readOnly = false,
		describedBy,
		collection,
		entityId,
	} = props;
	const [loadError, setLoadError] = useState<string | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const editor = useEditor({
		extensions,
		content: isDoc(value) ? (value as Record<string, unknown>) : null,
		editable: !readOnly,
		immediatelyRender: false,
		enableContentCheck: true,
		onContentError: ({ error }) => {
			setLoadError(
				`This document does not match the editor schema (${error.message}). Editing is disabled so it is not changed.`,
			);
		},
		editorProps: {
			attributes: {
				id: `${id}-content`,
				class: "prose-editor",
				role: "textbox",
				"aria-multiline": "true",
				"aria-labelledby": `${id}-label`,
				...(describedBy ? { "aria-describedby": describedBy } : {}),
			},
		},
		onUpdate: ({ editor: current }) => {
			onChangeRef.current(current.isEmpty ? null : current.getJSON());
		},
	});

	if (loadError) {
		return (
			<div className="rich-text rich-text--error" role="alert">
				<p>{loadError}</p>
				<pre className="rich-text__raw">{JSON.stringify(value, null, 2)}</pre>
			</div>
		);
	}

	return (
		<div className={`rich-text${readOnly ? " rich-text--readonly" : ""}`}>
			{editor && !readOnly && (
				<Toolbar editor={editor} collection={collection} entityId={entityId} />
			)}
			<EditorContent editor={editor} className="rich-text__content" />
		</div>
	);
}

interface ToolbarProps {
	editor: Editor;
	collection: string;
	entityId: string | undefined;
}

function Toolbar({ editor, collection, entityId }: ToolbarProps) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const state = useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			bold: e.isActive("bold"),
			italic: e.isActive("italic"),
			strike: e.isActive("strike"),
			code: e.isActive("code"),
			link: e.isActive("link"),
			h2: e.isActive("heading", { level: 2 }),
			h3: e.isActive("heading", { level: 3 }),
			h4: e.isActive("heading", { level: 4 }),
			bulletList: e.isActive("bulletList"),
			orderedList: e.isActive("orderedList"),
			taskList: e.isActive("taskList"),
			blockquote: e.isActive("blockquote"),
			codeBlock: e.isActive("codeBlock"),
		}),
	});

	const chain = () => editor.chain().focus();

	const setLink = () => {
		const previous = editor.getAttributes("link").href as string | undefined;
		const href = window.prompt(
			"Link URL (leave empty to remove the link)",
			previous ?? "https://",
		);
		if (href === null) return;
		if (href.trim() === "" || href.trim() === "https://") {
			chain().extendMarkRange("link").unsetLink().run();
			return;
		}
		chain().extendMarkRange("link").setLink({ href: href.trim() }).run();
	};

	const onImage = async (file: File | undefined) => {
		if (!file || !entityId) return;
		setUploading(true);
		setError(null);
		try {
			const uploaded = await uploadMedia(file, collection, entityId);
			const alt = window.prompt("Alt text for the image", "") ?? "";
			chain()
				.setImage({
					src: uploaded.url,
					alt,
					...(typeof uploaded.width === "number"
						? { width: uploaded.width }
						: {}),
					...(typeof uploaded.height === "number"
						? { height: uploaded.height }
						: {}),
				})
				.run();
		} catch (e) {
			setError(messageOf(e));
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	const buttons: {
		label: string;
		text: string;
		active?: boolean;
		run: () => void;
		mono?: boolean;
	}[][] = [
		[
			{
				label: "Bold",
				text: "B",
				active: state?.bold,
				run: () => chain().toggleBold().run(),
			},
			{
				label: "Italic",
				text: "I",
				active: state?.italic,
				run: () => chain().toggleItalic().run(),
			},
			{
				label: "Strikethrough",
				text: "S",
				active: state?.strike,
				run: () => chain().toggleStrike().run(),
			},
			{
				label: "Inline code",
				text: "</>",
				mono: true,
				active: state?.code,
				run: () => chain().toggleCode().run(),
			},
			{ label: "Link", text: "Link", active: state?.link, run: setLink },
		],
		[
			{
				label: "Heading 2",
				text: "H2",
				active: state?.h2,
				run: () => chain().toggleHeading({ level: 2 }).run(),
			},
			{
				label: "Heading 3",
				text: "H3",
				active: state?.h3,
				run: () => chain().toggleHeading({ level: 3 }).run(),
			},
			{
				label: "Heading 4",
				text: "H4",
				active: state?.h4,
				run: () => chain().toggleHeading({ level: 4 }).run(),
			},
		],
		[
			{
				label: "Bullet list",
				text: "• List",
				active: state?.bulletList,
				run: () => chain().toggleBulletList().run(),
			},
			{
				label: "Ordered list",
				text: "1. List",
				active: state?.orderedList,
				run: () => chain().toggleOrderedList().run(),
			},
			{
				label: "Task list",
				text: "☐ Tasks",
				active: state?.taskList,
				run: () => chain().toggleTaskList().run(),
			},
		],
		[
			{
				label: "Quote",
				text: "“ Quote",
				active: state?.blockquote,
				run: () => chain().toggleBlockquote().run(),
			},
			{
				label: "Code block",
				text: "{ } Code",
				mono: true,
				active: state?.codeBlock,
				run: () => chain().toggleCodeBlock().run(),
			},
			{
				label: "Horizontal rule",
				text: "— Rule",
				run: () => chain().setHorizontalRule().run(),
			},
		],
	];

	return (
		<div className="rich-text__toolbar" role="toolbar" aria-label="Formatting">
			{buttons.map((group) => (
				<div className="rich-text__group" key={group[0]?.label}>
					{group.map((button) => (
						<button
							key={button.label}
							type="button"
							className={`tool${button.active ? " tool--active" : ""}${button.mono ? " tool--mono" : ""}`}
							aria-label={button.label}
							aria-pressed={
								button.active === undefined ? undefined : button.active
							}
							title={button.label}
							onMouseDown={(event) => event.preventDefault()}
							onClick={button.run}
						>
							{button.text}
						</button>
					))}
				</div>
			))}
			<div className="rich-text__group">
				<input
					ref={fileRef}
					type="file"
					accept="image/*"
					className="visually-hidden"
					tabIndex={-1}
					aria-hidden="true"
					onChange={(event) => onImage(event.currentTarget.files?.[0])}
				/>
				<button
					type="button"
					className="tool"
					disabled={!entityId || uploading}
					title={
						entityId
							? "Upload and insert an image"
							: "Save the row before adding images"
					}
					onClick={() => fileRef.current?.click()}
				>
					{uploading ? "Uploading…" : "Image"}
				</button>
			</div>
			{error && (
				<p className="rich-text__error" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
