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
			className="w-24 h-24 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 mb-2"
			style={{ backgroundColor: color }}
		/>
		<p className="text-sm font-medium text-gray-900 dark:text-white">{name}</p>
		<code className="text-xs text-gray-500 dark:text-gray-400">{value}</code>
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
		<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
			{name}
		</h3>
		<p
			className={`${className} text-gray-700 dark:text-gray-300`}
			style={{ fontFamily: font }}
		>
			The quick brown fox jumps over the lazy dog
		</p>
		<p
			className={`${className} text-2xl text-gray-900 dark:text-white`}
			style={{ fontFamily: font }}
		>
			ABCDEFGHIJKLMNOPQRSTUVWXYZ
		</p>
		<p
			className={`${className} text-2xl text-gray-900 dark:text-white`}
			style={{ fontFamily: font }}
		>
			abcdefghijklmnopqrstuvwxyz
		</p>
		<p
			className={`${className} text-xl text-gray-900 dark:text-white`}
			style={{ fontFamily: font }}
		>
			0123456789
		</p>
		<code className="text-xs text-gray-500 dark:text-gray-400">{font}</code>
	</div>
);

export const Colors: Story = {
	render: () => (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
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
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
					Neutral Colors
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-5 gap-6">
					<ColorSwatch color="#111827" name="Black" value="#111827" />
					<ColorSwatch color="#374151" name="Gray 700" value="#374151" />
					<ColorSwatch color="#6B7280" name="Gray 500" value="#6B7280" />
					<ColorSwatch color="#D1D5DB" name="Gray 300" value="#D1D5DB" />
					<ColorSwatch color="#FFFFFF" name="White" value="#FFFFFF" />
				</div>
			</div>

			<div>
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
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
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
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
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
					Type Scale
				</h2>
				<div className="space-y-4">
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
							text-xs (12px)
						</p>
						<p className="text-xs text-gray-900 dark:text-white">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
							text-sm (14px)
						</p>
						<p className="text-sm text-gray-900 dark:text-white">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
							text-base (16px)
						</p>
						<p className="text-base text-gray-900 dark:text-white">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
							text-lg (18px)
						</p>
						<p className="text-lg text-gray-900 dark:text-white">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
							text-xl (20px)
						</p>
						<p className="text-xl text-gray-900 dark:text-white">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
							text-2xl (24px)
						</p>
						<p className="text-2xl text-gray-900 dark:text-white">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
							text-3xl (30px)
						</p>
						<p className="text-3xl text-gray-900 dark:text-white">
							The quick brown fox jumps over the lazy dog
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
							text-4xl (36px)
						</p>
						<p className="text-4xl text-gray-900 dark:text-white">
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
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
					Spacing Scale
				</h2>
				<div className="space-y-4">
					{[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64].map(
						(size) => (
							<div key={size} className="flex items-center gap-4">
								<code className="text-xs text-gray-500 dark:text-gray-400 w-16">
									{size}
								</code>
								<div
									className="bg-primary h-4"
									style={{ width: `${size * 0.25}rem` }}
								/>
								<span className="text-sm text-gray-600 dark:text-gray-400">
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
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
					Box Shadows
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<div className="space-y-2">
						<div className="w-full h-24 bg-white dark:bg-gray-800 rounded-lg shadow-sm flex items-center justify-center">
							<span className="text-sm text-gray-600 dark:text-gray-400">
								shadow-sm
							</span>
						</div>
					</div>
					<div className="space-y-2">
						<div className="w-full h-24 bg-white dark:bg-gray-800 rounded-lg shadow flex items-center justify-center">
							<span className="text-sm text-gray-600 dark:text-gray-400">
								shadow
							</span>
						</div>
					</div>
					<div className="space-y-2">
						<div className="w-full h-24 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-center justify-center">
							<span className="text-sm text-gray-600 dark:text-gray-400">
								shadow-md
							</span>
						</div>
					</div>
					<div className="space-y-2">
						<div className="w-full h-24 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center">
							<span className="text-sm text-gray-600 dark:text-gray-400">
								shadow-lg
							</span>
						</div>
					</div>
					<div className="space-y-2">
						<div className="w-full h-24 bg-white dark:bg-gray-800 rounded-lg shadow-xl flex items-center justify-center">
							<span className="text-sm text-gray-600 dark:text-gray-400">
								shadow-xl
							</span>
						</div>
					</div>
					<div className="space-y-2">
						<div className="w-full h-24 bg-white dark:bg-gray-800 rounded-lg shadow-2xl flex items-center justify-center">
							<span className="text-sm text-gray-600 dark:text-gray-400">
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
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
					Border Radius
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-none mx-auto mb-2" />
						<code className="text-xs text-gray-500 dark:text-gray-400">
							rounded-none
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-sm mx-auto mb-2" />
						<code className="text-xs text-gray-500 dark:text-gray-400">
							rounded-sm
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded mx-auto mb-2" />
						<code className="text-xs text-gray-500 dark:text-gray-400">
							rounded
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-md mx-auto mb-2" />
						<code className="text-xs text-gray-500 dark:text-gray-400">
							rounded-md
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-lg mx-auto mb-2" />
						<code className="text-xs text-gray-500 dark:text-gray-400">
							rounded-lg
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-xl mx-auto mb-2" />
						<code className="text-xs text-gray-500 dark:text-gray-400">
							rounded-xl
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-2xl mx-auto mb-2" />
						<code className="text-xs text-gray-500 dark:text-gray-400">
							rounded-2xl
						</code>
					</div>
					<div className="text-center">
						<div className="w-24 h-24 bg-primary rounded-full mx-auto mb-2" />
						<code className="text-xs text-gray-500 dark:text-gray-400">
							rounded-full
						</code>
					</div>
				</div>
			</div>
		</div>
	),
};

export const Gradients: Story = {
	render: () => (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
					Gradient Patterns
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Primary to Secondary
						</p>
						<div className="w-full h-24 bg-linear-to-r from-primary to-secondary rounded-lg" />
						<code className="text-xs text-gray-500 dark:text-gray-400">
							bg-linear-to-r from-primary to-secondary
						</code>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Primary to Tertiary
						</p>
						<div className="w-full h-24 bg-linear-to-r from-primary to-tertiary rounded-lg" />
						<code className="text-xs text-gray-500 dark:text-gray-400">
							bg-linear-to-r from-primary to-tertiary
						</code>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Secondary to Quaternary
						</p>
						<div className="w-full h-24 bg-linear-to-r from-secondary to-quaternary rounded-lg" />
						<code className="text-xs text-gray-500 dark:text-gray-400">
							bg-linear-to-r from-secondary to-quaternary
						</code>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Diagonal Gradient
						</p>
						<div className="w-full h-24 bg-linear-to-br from-primary via-secondary to-tertiary rounded-lg" />
						<code className="text-xs text-gray-500 dark:text-gray-400">
							bg-linear-to-br from-primary via-secondary to-tertiary
						</code>
					</div>
				</div>
			</div>
		</div>
	),
};
