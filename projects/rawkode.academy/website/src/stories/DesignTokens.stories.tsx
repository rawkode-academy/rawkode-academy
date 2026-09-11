import type { Meta, StoryObj } from "@storybook/react";

const meta = {
	title: "Design System/Design Tokens",
	parameters: {
		layout: "padded",
		backgrounds: { default: "mocha" },
	},
	decorators: [
		(Story) => {
			if (typeof document !== "undefined") {
				document.documentElement.classList.add("dark");
			}
			return (
				<div style={{ background: "var(--ctp-mocha-base)", padding: "1.5rem" }}>
					<Story />
				</div>
			);
		},
	],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const ColorSwatch = ({
	color,
	name,
	value,
}: {
	color: string;
	name: string;
	value: string;
}) => (
	<div className="flex flex-col items-center">
		<div
			className="w-24 h-24 rounded-[2px] border border-surface mb-2"
			style={{ backgroundColor: color }}
		/>
		<p className="text-sm font-medium text-primary-content">{name}</p>
		<code className="text-xs text-muted">{value}</code>
	</div>
);

export const MochaSurfaces: Story = {
	render: () => (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold text-primary-content mb-6">
					Catppuccin Mocha Surfaces
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-3 gap-6">
					<ColorSwatch color="#11111b" name="crust" value="--ctp-mocha-crust" />
					<ColorSwatch color="#181825" name="mantle" value="--ctp-mocha-mantle" />
					<ColorSwatch color="#1e1e2e" name="base" value="--ctp-mocha-base" />
					<ColorSwatch color="#313244" name="surface0" value="--ctp-mocha-surface0" />
					<ColorSwatch color="#45475a" name="surface1" value="--ctp-mocha-surface1" />
					<ColorSwatch color="#585b70" name="surface2" value="--ctp-mocha-surface2" />
				</div>
			</div>

			<div>
				<h2 className="text-2xl font-bold text-primary-content mb-6">Text</h2>
				<div className="grid grid-cols-2 md:grid-cols-3 gap-6">
					<ColorSwatch color="#cdd6f4" name="text" value="--ctp-mocha-text" />
					<ColorSwatch color="#bac2de" name="subtext1" value="--ctp-mocha-subtext1" />
					<ColorSwatch color="#a6adc8" name="subtext0" value="--ctp-mocha-subtext0" />
					<ColorSwatch color="#9399b2" name="overlay2" value="--ctp-mocha-overlay2" />
					<ColorSwatch color="#7f849c" name="overlay1" value="--ctp-mocha-overlay1" />
					<ColorSwatch color="#6c7086" name="overlay0" value="--ctp-mocha-overlay0" />
				</div>
			</div>

			<div>
				<h2 className="text-2xl font-bold text-primary-content mb-6">Accents</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
					<ColorSwatch color="#89b4fa" name="blue (links)" value="--ctp-mocha-blue" />
					<ColorSwatch color="#b4befe" name="lavender (focus)" value="--ctp-mocha-lavender" />
					<ColorSwatch color="#74c7ec" name="sapphire" value="--ctp-mocha-sapphire" />
					<ColorSwatch color="#94e2d5" name="teal (kickers)" value="--ctp-mocha-teal" />
					<ColorSwatch color="#a6e3a1" name="green (live)" value="--ctp-mocha-green" />
					<ColorSwatch color="#fab387" name="peach (CTA)" value="--ctp-mocha-peach" />
					<ColorSwatch color="#f9e2af" name="yellow" value="--ctp-mocha-yellow" />
					<ColorSwatch color="#f38ba8" name="red" value="--ctp-mocha-red" />
				</div>
			</div>
		</div>
	),
};

export const Typography: Story = {
	render: () => (
		<div className="space-y-8 text-primary-content">
			<div>
				<p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--ctp-mocha-teal)] mb-2">
					Kicker / mono
				</p>
				<p
					className="text-3xl font-semibold tracking-tight"
					style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
				>
					Inter Tight — chrome &amp; headlines
				</p>
				<p
					className="mt-4 text-sm"
					style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}
				>
					JetBrains Mono — labels, keycaps, metadata
				</p>
			</div>
		</div>
	),
};

export const ChromeSamples: Story = {
	render: () => (
		<div className="space-y-6">
			<div
				className="flex items-center gap-3 px-4 h-16 border"
				style={{
					background: "var(--ctp-mocha-mantle)",
					borderColor: "var(--ctp-mocha-surface1)",
				}}
			>
				<span
					className="inline-flex items-center px-3 py-1.5 text-sm"
					style={{
						background: "var(--ctp-mocha-surface1)",
						color: "var(--ctp-mocha-text)",
						borderRadius: "2px",
					}}
				>
					Active nav chip
				</span>
				<span className="text-sm" style={{ color: "var(--ctp-mocha-lavender)" }}>
					Hover lavender
				</span>
				<span
					className="ml-auto inline-flex items-center px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider"
					style={{
						background: "var(--ctp-mocha-peach)",
						color: "var(--ctp-mocha-base)",
						borderRadius: "2px",
					}}
				>
					Sign in
				</span>
			</div>
			<p className="text-sm text-muted">
				Hairlines only — no soft elevation. Focus ring: 2px lavender.
			</p>
		</div>
	),
};
