import type { Bracket } from "./queries";

// Mirrors the read model's openBrackets eligibility for navigation only.
// Registration remains authorized and validated by the existing write service.
export function isRegistrationOpen(
	bracket: Bracket,
	now = Date.now(),
): boolean {
	return (
		bracket.status === "active" &&
		(!bracket.registrationClosesAt ||
			Date.parse(bracket.registrationClosesAt) > now)
	);
}
