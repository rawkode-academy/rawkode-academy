import type { SystemStyleObject } from "../../styled-system/types";
import { focusRing } from "./focus";

/**
 * A text input: its surface and every state. The slot sets the metrics
 * (height, padding, font size), because a search bar, a toolbar filter and
 * a form field differ in size and in the room they leave for an icon.
 *
 *   input: { ...inputField, minHeight: "12", paddingInline: "4" },
 *
 * On an ink surface override the ring: `_focusVisible: focusRingInk`.
 */
export const inputField = {
	width: "full",
	minWidth: "0",
	border: "hairline",
	borderColor: "academy.inputBorder",
	borderRadius: "academy-s",
	backgroundColor: "academy.input",
	color: "academy.text",
	_placeholder: { color: "academy.textMuted", opacity: "1" },
	_focusVisible: focusRing,
	_disabled: { opacity: "0.6", cursor: "not-allowed" },
	"&:is([aria-invalid='true'], :user-invalid)": {
		borderColor: "academy.statusRust",
	},
} as const satisfies SystemStyleObject;
