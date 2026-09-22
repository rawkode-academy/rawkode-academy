import { sva } from "../../styled-system/css";

export const academyCommand = sva({
	slots: ["positioner", "content", "header", "title", "input", "list", "group", "item", "label", "description", "status", "footer"],
	base: {
		positioner: { position: "fixed", inset: "0", zIndex: "overlay", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "4", paddingTop: "16" },
		content: { width: "full", maxWidth: "2xl", maxHeight: "academy-command", display: "flex", flexDirection: "column", minWidth: "0", border: "hairline", borderColor: "academy.border", borderRadius: "academy-l", background: "academy.panel", color: "academy.text", boxShadow: "dialog", fontFamily: "academy-text", overflow: "hidden" },
		header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "3", padding: "4", borderBottom: "hairline", borderColor: "academy.border" },
		title: { fontFamily: "academy-display", fontWeight: "bold", fontSize: "lg" },
		input: { width: "full", minHeight: "12", padding: "4", background: "academy.input", color: "academy.text", borderBottom: "hairline", borderColor: "academy.inputBorder", fontSize: "md", _placeholder: { color: "academy.textMuted" }, _focusVisible: { outline: "focus", outlineColor: "academy.accent", outlineOffset: "focus-inset" } },
		list: { overflowY: "auto", maxHeight: "academy-command-list", padding: "2", overscrollBehavior: "contain" },
		group: { padding: "3", fontFamily: "academy-mono", fontSize: "xs", color: "academy.textMuted", letterSpacing: "wide" },
		item: { display: "flex", flexDirection: "column", gap: "1", padding: "3", borderRadius: "academy-s", color: "academy.text", cursor: "pointer", _hover: { background: "academy.ground" }, _highlighted: { background: "academy.ground", outline: "focus", outlineColor: "academy.accent", outlineOffset: "focus-inset" } },
		label: { fontWeight: "semibold", fontSize: "sm", overflowWrap: "anywhere" },
		description: { fontSize: "sm", color: "academy.textMuted", overflowWrap: "anywhere" },
		status: { padding: "4", color: "academy.textMuted", fontSize: "sm" },
		footer: { padding: "3", borderTop: "hairline", borderColor: "academy.border", color: "academy.textMuted", fontSize: "xs" },
	},
});
