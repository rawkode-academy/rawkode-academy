// Replaces `shiki/themes` (aliased in astro.config.mts) for Expressive Code's
// Shiki plugin, which imports the full theme map; the site uses one theme.
export const bundledThemes = {
	"catppuccin-mocha": () => import("shiki/themes/catppuccin-mocha.mjs"),
};
