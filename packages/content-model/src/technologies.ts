// Allowed values for technology profiles. The website's explorer renders
// these and the technologies write model validates against them, so a value
// can only be stored if the website knows how to show it.

export const MATRIX_GROUPING_VALUES = [
	"plumbing",
	"platform",
	"observability",
	"security",
] as const;

export const MATRIX_STATUS_VALUES = [
	"skip",
	"watch",
	"explore",
	"learn",
	"adopt",
	"advocate",
	"graveyard",
	"guilty-pleasure",
] as const;

export const MATRIX_CONFIDENCE_VALUES = [
	"gut",
	"some-experience",
	"deep-experience",
] as const;

export const MATRIX_TRAJECTORY_VALUES = [
	"rising",
	"stable",
	"falling",
] as const;

export const CNCF_STATUS_VALUES = [
	"sandbox",
	"incubating",
	"graduated",
	"archived",
] as const;

export const TECHNOLOGY_STATUS_VALUES = [
	"alpha",
	"beta",
	"stable",
	"preview",
	"superseded",
	"deprecated",
	"abandoned",
] as const;
