import {
	academyLayout,
	academySearch,
	button,
} from "@rawkodeacademy/design-system";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
	title: "Design System/Ink masthead",
	// Screenshot baselines in visual/__screenshots__ (bun run test:visual).
	tags: ["visual"],
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"Every page opens in ink. `inkStage` (`src/styles/ink.ts`) is the surface: ink, its hairline and the system grid rising from the top edge. `mastheadTitle` and `ledeText` (`src/styles/type.ts`) are the type set on it. Padding and height stay with each slot.",
			},
		},
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A collection masthead: the collection's name with its real count beside it. */
export const Collection: Story = {
	render: () => {
		const s = academyLayout({ width: "wide" });
		return (
			<header className={s.masthead}>
				<div className={s.container}>
					<div className={s.mastheadInner}>
						<div className={s.mastheadCopy}>
							<div className={s.mastheadTitle}>
								<h1 className={s.mastheadHeading}>Videos</h1>
								<span className={s.mastheadCount} aria-hidden="true">
									329
								</span>
							</div>
							<p className={s.mastheadSummary}>329 videos</p>
						</div>
						<p className={s.mastheadDescription}>
							Live sessions, deep dives and Klustered rescues, newest first.
						</p>
						<div className={s.mastheadAside}>
							<a
								className={button({ variant: "outline", surface: "ink" })}
								href="#shows"
							>
								Browse by show
							</a>
						</div>
					</div>
				</div>
			</header>
		);
	},
};

/** Search opens on the same stage and holds a form; the field and filters take the ink focus ring. */
export const Search: Story = {
	render: () => {
		const s = academySearch();
		return (
			<header className={s.header}>
				<div className={s.headerInner}>
					<h1 className={s.title}>Find your next lesson.</h1>
					<p className={s.lede}>
						Search videos, articles, news, courses and technologies.
					</p>
					<form
						className={s.form}
						role="search"
						onSubmit={(event) => event.preventDefault()}
					>
						<label className={s.field} htmlFor="story-search">
							Search the Academy
							<input
								id="story-search"
								className={s.input}
								type="search"
								placeholder="Kubernetes, eBPF, GitOps…"
							/>
						</label>
						<button
							className={button({ surface: "ink", size: "lg" })}
							type="submit"
						>
							Search
						</button>
					</form>
					<nav aria-label="Suggested searches">
						<ul className={s.filters}>
							{["Cilium", "Gateway API", "Talos Linux", "WebAssembly"].map(
								(label, index) => (
									<li key={label}>
										<a
											className={s.filter}
											href="#suggestion"
											aria-current={index === 0 ? "page" : undefined}
										>
											{label}
										</a>
									</li>
								),
							)}
						</ul>
					</nav>
				</div>
			</header>
		);
	},
};
