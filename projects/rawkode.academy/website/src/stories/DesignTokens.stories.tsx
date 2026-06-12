import type { Meta, StoryObj } from "@storybook/react";

const meta = {
	title: "Design System/Design Tokens",
	parameters: {
		layout: "padded",
	},
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
			className="w-24 h-24 rounded-lg shadow-md border border-surface mb-2"
			style={{ backgroundColor: color }}
		/>
		<p className="text-sm font-medium text-primary-content">{name}</p>
		<code className="text-xs text-muted">{value}</code>
	</div>
);

const TextSample = ({
	font,
	name,
	className,
}: {
	font: string;
	name: string;
	className: string;
}) => (
	<div className="space-y-2">
		<h3 className="text-lg font-semibold text-primary-content">
			{name}
		</h3>
		<p
			className={`${className} text-secondary-content`}
			style={{ fontFamily: font }}
		>
			The quick brown fox jumps over the lazy dog
		</p>
		<p
			className={`${className} text-2xl text-primary-content`}
			style={{ fontFamily: font }}
		>
			ABCDEFGHIJKLMNOPQRSTUVWXYZ
		</p>
		<p
			className={`${className} text-2xl text-primary-content`}
			style={{ fontFamily: font }}
		>
			abcdefghijklmnopqrstuvwxyz
		</p>
		<p
			className={`${className} text-xl text-primary-content`}
			style={{ fontFamily: font }}
		>
			0123456789
		</p>
		<code className="text-xs text-muted">{font}</code>
	</div>
);

export const Colors: Story = {
	render: () => (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold text-primary-content mb-6">
					Brand Colors
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
					<ColorSwatch color="#5f5ed7" name="Primary" value="#5f5ed7" />
					<ColorSwatch color="#00ceff" name="Secondary" value="#00ceff" />
					<ColorSwatch color="#04b59c" name="Tertiary" value="#04b59c" />
					<ColorSwatch color="#85ff95" name="Quaternary" value="#85ff95" />
				</div>
			</div>

			<div>
				<h2 className="text-2xl font-bold text-primary-content mb-6">
					Editorial Neutrals
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-5 gap-6">
					<ColorSwatch
						color="var(--editorial-ink)"
						name="Ink"
						value="var(--editorial-ink)"
					/>
					<ColorSwatch
						color="var(--editorial-ink-soft)"
						name="Ink soft"
						value="var(--editorial-ink-soft)"
					/>
					<ColorSwatch
						color="var(--editorial-ink-mute)"
						name="Ink mute"
						value="var(--editorial-ink-mute)"
					/>
					<ColorSwatch
						color="var(--editorial-paper-deep)"
						name="Paper deep"
						value="var(--editorial-paper-deep)"
					/>
					<ColorSwatch
						color="var(--editorial-paper)"
						name="Paper"
						value="var(--editorial-paper)"
					/>
				</div>
			</div>

			<div>
				<h2 className="text-2xl font-bold text-primary-content mb-6">
					Semantic Colors
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
					<ColorSwatch color="#10B981" name="Success" value="#10B981" />
					<ColorSwatch color="#F59E0B" name="Warning" value="#F59E0B" />
					<ColorSwatch color="#EF4444" name="Error" value="#EF4444" />
					<ColorSwatch color="#3B82F6" name="Info" value="#3B82F6" />
				</div>
			</div>
		</div>
	),
};

export const Typography: Story = {
	render: () => (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold text-primary-content mb-6">
					Font Families
				</h2>
				<div className="space-y-8">
					<TextSample
						font="'Quicksand', sans-serif"
						name="Display Font (Headings)"
						className="font-display"
					/>
					<TextSample
						font="'Poppins', sans-serif"
						name="Body Font (Text)"
						className="font-body"
					/>
					<TextSample
						font="'Monaspace', monospace"
						name="Monospace Font (Code)"
						className="font-mono"
					/>
				</div>
			</div>

			<div>
				<h2 className="text-2xl font-bold text-primary-content mb-6">
					Type Scale
				</h2>
				<div className="space-y-4">
					<div>
						<p className="text-xs text-muted mb-1">
							text-xs (12px)
						</p>
						<p className="text-xs text-primary-content">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-muted mb-1">
							text-sm (14px)
						</p>
						<p className="text-sm text-primary-content">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-muted mb-1">
							text-base (16px)
						</p>
						<p className="text-base text-primary-content">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-muted mb-1">
							text-lg (18px)
						</p>
						<p className="text-lg text-primary-content">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-muted mb-1">
							text-xl (20px)
						</p>
						<p className="text-xl text-primary-content">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-muted mb-1">
							text-2xl (24px)
						</p>
						<p className="text-2xl text-primary-content">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-muted mb-1">
							text-3xl (30px)
						</p>
						<p className="text-3xl text-primary-content">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-muted mb-1">
							text-4xl (36px)
						</p>
						<p className="text-4xl text-primary-content">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
				</div>
			</div>
		</div>
	),
};

export const Spacing: Story = {
	render: () => (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold text-primary-content mb-6">
					Spacing Scale
				</h2>
				<div className="space-y-4">
					{[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64].map(
						(size) => (
							<div key={size} className="flex items-center gap-4">
								<code className="text-xs text-muted w-16">
									{size}
								</code>
								<div
									className="bg-primary h-4"
									style={{ width: `${size * 0.25}rem` }}
								/>
								<span className="text-sm text-secondary-content">
									{size * 0.25}rem / {size * 4}px
								</span>
							</div>
						),
					)}
				</div>
			</div>
		</div>
	),
};

export const Shadows: Story = {
	render: () => (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold text-primary-content mb-6">
					Box Shadows
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<div className="space-y-2">
						<div className="w-full h-24 bg-[var(--surface-card)] rounded-lg shadow-sm flex items-center justify-center">
							<span className="text-sm text-secondary-content">
								shadow-sm
							</span>
						</div>
					</div>
					<div className="space-y-2">
						<div className="w-full h-24 bg-[var(--surface-card)] rounded-lg shadow flex items-center justify-center">
							<span className="text-sm text-secondary-content">
								shadow
							</span>
						</div>
					</div>
					<div className="space-y-2">
						<div className="w-full h-24 bg-[var(--surface-card)] rounded-lg shadow-md flex items-center justify-center">
							<span className="text-sm text-secondary-content">
								shadow-md
							</span>
						</div>
					</div>
					<div className="space-y-2">
						<div className="w-full h-24 bg-[var(--surface-card)] rounded-lg shadow-lg flex items-center justify-center">
							<span className="text-sm text-secondary-content">
								shadow-lg
							</span>
						</div>
					</div>
					<div className="space-y-2">
						<div className="w-full h-24 bg-[var(--surface-card)] rounded-lg shadow-xl flex items-center justify-center">
							<span className="text-sm text-secondary-content">
								shadow-xl
							</span>
						</div>
					</div>
					<div className="space-y-2">
						<div className="w-full h-24 bg-[var(--surface-card)] rounded-lg shadow-2xl flex items-center justify-center">
							<span className="text-sm text-secondary-content">
								shadow-2xl
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	),
};

export const BorderRadius: Story = {
	render: () => (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold text-primary-content mb-6">
					Border Radius
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-none mx-auto mb-2" />
						<code className="text-xs text-muted">
							rounded-none
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-sm mx-auto mb-2" />
						<code className="text-xs text-muted">
							rounded-sm
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded mx-auto mb-2" />
						<code className="text-xs text-muted">
							rounded
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-md mx-auto mb-2" />
						<code className="text-xs text-muted">
							rounded-md
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-lg mx-auto mb-2" />
						<code className="text-xs text-muted">
							rounded-lg
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-xl mx-auto mb-2" />
						<code className="text-xs text-muted">
							rounded-xl
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-2xl mx-auto mb-2" />
						<code className="text-xs text-muted">
							rounded-2xl
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-full mx-auto mb-2" />
						<code className="text-xs text-muted">
							rounded-full
						</code>
					</div>
				</div>
			</div>
		</div>
	),
};

export const Surfaces: Story = {
	render: () => (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold text-primary-content mb-6">
					Editorial Surfaces
				</h2>
				<p className="text-sm text-secondary-content mb-6 max-w-2xl">
					Editorial design uses flat surfaces with 1px hairline borders — no
					gradients, no backdrop blur, no depth shadows. The four primary
					surface tokens cover ~95% of cases.
				</p>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{[
						["Paper", "var(--editorial-paper)", "Default page background"],
						[
							"Paper deep",
							"var(--editorial-paper-deep)",
							"Secondary surface — card backgrounds, video frames",
						],
						[
							"Surface card muted",
							"var(--surface-card-muted)",
							"Hover state, subtle wells",
						],
						[
							"Ink",
							"var(--editorial-ink)",
							"Solid ink background (CTAs, panels)",
						],
					].map(([name, value, note]) => (
						<div key={name}>
							<p className="text-sm font-medium text-primary-content mb-2">
								{name}
							</p>
							<div
								className="w-full h-24 rounded-sm border border-[var(--editorial-hairline)]"
								style={{ background: value }}
							/>
							<code className="text-xs text-muted block mt-2">{value}</code>
							<p className="text-xs text-muted mt-1">{note}</p>
						</div>
					))}
				</div>
			</div>
		</div>
	),
};
