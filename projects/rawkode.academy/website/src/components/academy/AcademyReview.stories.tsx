import type { Meta, StoryObj } from "@storybook/react";
import {
	academyDocument,
	academyForms,
	academyLayout,
} from "@rawkodeacademy/design-system";
import { useId } from "react";
import { defineComponent, h } from "vue";
import { expect, waitFor, within } from "storybook/test";
import { VueInReact } from "../vue-wrapper";
import CourseDetailHero from "../courses/CourseDetailHero.vue";
import ResourceList from "../courses/ResourceList.vue";
import VideoProgressBar from "../video/VideoProgressBar.vue";
import Badge from "../common/Badge.vue";
import EmptyState from "../ui/EmptyState.vue";
import ErrorState from "../common/ErrorState.vue";
import SkeletonTranscript from "../common/SkeletonTranscript.vue";
import ResourceSimulator from "../articles/cgroups/ResourceSimulator";
import teleportCover from "../../../../../../content/courses/teleport-for-kubernetes.png?url";

const doc = academyDocument();
const form = academyForms();
const layout = academyLayout({ width: "reading" });

const meta = {
	title: "Academy/Review",
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"Production components with local, deterministic fixtures. Use the Academy theme toolbar and resize the canvas for mobile review. No authentication, analytics, requests, or submissions. Form specimens exercise academyForms, not live Astro actions.",
			},
		},
	},
	decorators: [
		(Story) => (
			<div className={[doc.root, doc.section, doc.stack].join(" ")}>
				<p className={doc.meta}>
					Component review · local fixtures · no external submissions
				</p>
				<Story />
			</div>
		),
	],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const courseProps = {
	title: "Teleport for Kubernetes",
	description:
		"Learn to deploy, configure, and operate Teleport as the access layer for your Kubernetes clusters.",
	moduleCount: 6,
	availableModuleCount: 6,
	difficulty: "Intermediate",
	authors: [{ name: "David Flanagan", href: "#review-author" }],
	cover: {
		src: teleportCover,
		alt: "Teleport for Kubernetes course artwork",
		width: 1376,
		height: 768,
	},
};

function CourseFixture({ empty = false }: { empty?: boolean }) {
	return (
		<>
			<VueInReact
				component={CourseDetailHero}
				props={{
					...courseProps,
					...(empty
						? {
								moduleCount: 0,
								availableModuleCount: 0,
								cover: undefined,
								authors: [],
							}
						: {}),
				}}
			/>
			<section
				id="course-content"
				className={doc.panel}
				aria-label="Curriculum anchor fixture"
			>
				<p className={doc.copy}>
					Curriculum anchor target. This specimen does not recreate the course
					page.
				</p>
			</section>
			{!empty && (
				<p id="review-author" className={doc.meta}>
					Author link target · local fixture
				</p>
			)}
		</>
	);
}

export const Default: Story = { render: () => <CourseFixture /> };
export const CourseWithoutLessons: Story = {
	render: () => <CourseFixture empty />,
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByText("0 of 0 lessons available");
	},
};

export const Empty: Story = {
	render: () => (
		<VueInReact
			component={EmptyState}
			props={{
				title: "No matching lessons",
				body: "Try another search or clear your filters.",
			}}
		/>
	),
};

export const Loading: Story = {
	render: () => (
		<div className={[layout.container, doc.panel].join(" ")} aria-busy="true">
			<VueInReact component={SkeletonTranscript} />
		</div>
	),
};

export const Error: Story = {
	render: () => (
		<VueInReact
			component={ErrorState}
			props={{
				title: "Transcript unavailable",
				message:
					"Static error specimen. No request has been made; no retry handler is attached.",
				centered: false,
			}}
		/>
	),
};

function ProgressFixture({ progress }: { progress: number }) {
	return (
		<div className={[layout.container, doc.panel].join(" ")}>
			<h2 className={doc.cardTitle}>Video progress · {progress}%</h2>
			<VueInReact
				component={VideoProgressBar}
				props={{ progress, showLabel: true, height: "lg" }}
			/>
		</div>
	);
}

const progressCheck =
	(value: number): NonNullable<Story["play"]> =>
	async ({ canvasElement }) => {
		const progress = await within(canvasElement).findByRole("progressbar", {
			name: "Video progress",
		});
		await expect(progress).toHaveAttribute("aria-valuenow", String(value));
	};
export const Progress0: Story = {
	render: () => <ProgressFixture progress={0} />,
	play: progressCheck(0),
};
export const Progress50: Story = {
	render: () => <ProgressFixture progress={50} />,
	play: progressCheck(50),
};
export const Progress100: Story = {
	render: () => <ProgressFixture progress={100} />,
	play: progressCheck(100),
};

// Render functions provide real Vue slots through the existing React wrapper;
// no runtime template compiler or string-as-slot workaround is required.
const BadgeSpecimen = defineComponent({
	setup: () => () =>
		h(
			"div",
			{ class: doc.stack },
			[false, true].map((outline) =>
				h(
					"div",
					{ class: doc.actions },
					(
						[
							"default",
							"primary",
							"secondary",
							"success",
							"warning",
							"danger",
							"info",
						] as const
					).map((variant) =>
						h(
							Badge,
							{ variant, outline },
							{ default: () => `${variant}${outline ? " outline" : ""}` },
						),
					),
				),
			),
		),
});
export const Badges: Story = {
	render: () => <VueInReact component={BadgeSpecimen} />,
};

type FormState = "default" | "error" | "disabled";
function FormRecipeFixture({ state = "default" }: { state?: FormState }) {
	const id = useId();
	const invalid = state === "error";
	const disabled = state === "disabled";
	return (
		<section
			className={[layout.container, form.root, form.panel].join(" ")}
			aria-label="Form recipe specimen"
		>
			<h2 className={form.heading}>Form fields · {state}</h2>
			<p className={form.copy}>
				Recipe-only specimen. Live course signup and partnership forms require
				Astro actions and are intentionally not imported. No data is submitted
				or saved.
			</p>
			<div className={form.field}>
				<label className={form.label} htmlFor={`${id}-email`}>
					Email address
				</label>
				<input
					className={form.input}
					id={`${id}-email`}
					name="email"
					type="email"
					autoComplete="off"
					placeholder="you@example.test"
					defaultValue={invalid ? "not-an-email" : ""}
					disabled={disabled}
					aria-invalid={invalid || undefined}
					aria-describedby={`${id}-email-help`}
				/>
				<p
					id={`${id}-email-help`}
					className={invalid ? form.fieldError : form.copy}
					role={invalid ? "alert" : undefined}
				>
					{invalid
						? "Enter an email address such as you@example.test."
						: "Use fixture data only. This field is not connected to a service."}
				</p>
			</div>
			<div className={form.field}>
				<label className={form.label} htmlFor={`${id}-interest`}>
					Area of interest
				</label>
				<select
					id={`${id}-interest`}
					className={form.input}
					disabled={disabled}
					defaultValue="platform"
				>
					<option value="platform">Platform engineering</option>
					<option value="security">Kubernetes security</option>
				</select>
			</div>
			<div className={form.field}>
				<label className={form.label} htmlFor={`${id}-notes`}>
					Notes <em>(optional)</em>
				</label>
				<textarea
					id={`${id}-notes`}
					className={[form.input, form.textarea].join(" ")}
					rows={3}
					disabled={disabled}
				/>
			</div>
			<div className={form.consent}>
				<input
					id={`${id}-consent`}
					className={form.checkbox}
					type="checkbox"
					disabled={disabled}
				/>
				<label htmlFor={`${id}-consent`} className={form.copy}>
					Optional consent checkbox specimen
				</label>
			</div>
			<button className={form.button} type="button" disabled={disabled}>
				Button specimen · no submission
			</button>
		</section>
	);
}

export const FormLabels: Story = {
	render: () => <FormRecipeFixture />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("textbox", { name: "Email address" }),
		).toHaveAccessibleDescription(
			"Use fixture data only. This field is not connected to a service.",
		);
		await expect(
			canvas.getByRole("combobox", { name: "Area of interest" }),
		).toBeEnabled();
		await expect(
			canvas.getByRole("checkbox", {
				name: "Optional consent checkbox specimen",
			}),
		).toBeEnabled();
	},
};
export const FormError: Story = {
	render: () => <FormRecipeFixture state="error" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("textbox", { name: "Email address" }),
		).toHaveAttribute("aria-invalid", "true");
		await expect(canvas.getByRole("alert")).toHaveTextContent(
			"Enter an email address",
		);
	},
};
export const Disabled: Story = {
	render: () => <FormRecipeFixture state="disabled" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		for (const role of ["textbox", "combobox", "checkbox", "button"] as const) {
			for (const control of canvas.getAllByRole(role))
				await expect(control).toBeDisabled();
		}
	},
};
export const FormFocus: Story = {
	render: () => <FormRecipeFixture />,
	play: async ({ canvasElement }) => {
		const email = within(canvasElement).getByRole("textbox", {
			name: "Email address",
		});
		email.focus();
		await waitFor(() => expect(email).toHaveFocus());
	},
};

export const Simulator: Story = { render: () => <ResourceSimulator /> };

const resourceFixtures = [
	{
		title: "Teleport documentation",
		description: "Configure identity-based access for a Kubernetes cluster.",
		type: "url",
		url: "https://example.test/teleport",
		category: "documentation",
	},
	{
		title: "Cluster setup checklist.pdf",
		description: "A downloadable checklist for the lab.",
		type: "file",
		filePath: "review/checklist.pdf",
		category: "__proto__",
	},
	{
		title: "OAuth PKCE playground",
		description: "Inspect an authorization-code exchange.",
		type: "embed",
		embedConfig: {
			container: "webcontainer",
			src: "review-oauth",
			height: "600px",
			width: "100%",
		},
		category: "code",
	},
	{
		title: "Access policy walkthrough",
		type: "embed",
		embedConfig: {
			container: "iframe",
			src: "https://example.test/policy",
			height: "600px",
			width: "100%",
		},
		category: "demos",
	},
	{
		title: "Invalid empty URL",
		type: "url",
		url: "",
		category: "documentation",
	},
	{
		title: "Invalid placeholder URL",
		type: "url",
		url: "#",
		category: "documentation",
	},
	{ title: "Invalid missing embed", type: "embed", category: "demos" },
] as const;

export const Resources: Story = {
	render: () => (
		<div
			className={[layout.container, doc.stack].join(" ")}
			onClickCapture={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
			onAuxClickCapture={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
		>
			<p className={doc.meta}>
				Real ResourceList · activation blocked in this review fixture; no
				navigation, iframe loading, or WebContainer boot.
			</p>
			<VueInReact
				component={ResourceList}
				props={{ resources: resourceFixtures, courseId: "review-course" }}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await canvas.findByRole("heading", { name: "Resources", level: 2 });
		await expect(
			canvas.getByRole("heading", { name: "Other", level: 3 }),
		).toBeInTheDocument();
		await expect(canvas.getAllByRole("link")).toHaveLength(2);
		await expect(canvas.getAllByRole("button")).toHaveLength(2);
		await expect(
			canvas.queryByText("Invalid empty URL"),
		).not.toBeInTheDocument();
		await expect(
			canvas.queryByText("Invalid placeholder URL"),
		).not.toBeInTheDocument();
		await expect(
			canvas.queryByText("Invalid missing embed"),
		).not.toBeInTheDocument();
	},
};

export const ResourcesEmpty: Story = {
	render: () => (
		<div className={layout.container}>
			<p className={doc.meta}>
				Empty resource collection: no Resources heading or empty panel should
				follow.
			</p>
			<VueInReact component={ResourceList} props={{ resources: [] }} />
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).queryByRole("heading", { name: "Resources" }),
		).not.toBeInTheDocument();
	},
};
