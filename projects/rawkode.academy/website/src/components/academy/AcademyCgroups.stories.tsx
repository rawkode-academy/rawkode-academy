import type { Meta, StoryObj } from "@storybook/react";
import { academyCgroups } from "@rawkodeacademy/design-system";
import { expect, userEvent, within } from "storybook/test";
import HierarchyExplorer, {
	ControllerBadge,
} from "../articles/cgroups/HierarchyExplorer";
import CgroupTimeline from "../articles/cgroups/CgroupTimeline";
import PodCgroupMapper from "../articles/cgroups/PodCgroupMapper";

const styles = academyCgroups();
const meta = {
	title: "Academy/Cgroups",
	parameters: { layout: "padded" },
	decorators: [
		(Story) => (
			<div>
				<p className={styles.muted}>
					Production teaching widgets · no network calls · use the Academy
					light/dark toolbar
				</p>
				<Story />
			</div>
		),
	],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const HierarchyV1: Story = { render: () => <HierarchyExplorer /> };
export const HierarchyV1Collapsed: Story = {
	render: () => <HierarchyExplorer />,
	play: async ({ canvasElement }) => {
		const buttons = within(canvasElement).getAllByRole("button", {
			expanded: true,
		});
		for (const button of buttons) await userEvent.click(button);
	},
};
export const HierarchyV2: Story = {
	render: () => <HierarchyExplorer />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "cgroupsv2" }),
		);
	},
};
export const ControllerBadges: Story = {
	render: () => (
		<div className={styles.badges}>
			{["cpu", "memory", "io", "pids", "cpuset", "future-controller"].map(
				(name) => (
					<ControllerBadge key={name} name={name} />
				),
			)}
		</div>
	),
};
export const Timeline: Story = { render: () => <CgroupTimeline /> };
export const TimelineExpanded: Story = {
	render: () => <CgroupTimeline />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "2016 Mar v2 declared stable",
			}),
		);
	},
};
export const TimelineKeyboardFocus: Story = {
	render: () => <CgroupTimeline />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const first = canvas.getByRole("button", {
			name: "2006 Process containers proposed",
		});
		first.focus();
		await userEvent.keyboard("{ArrowRight}");
		await expect(
			canvas.getByRole("button", { name: "2007 Renamed to cgroups" }),
		).toHaveFocus();
	},
};
export const Guaranteed: Story = { render: () => <PodCgroupMapper /> };
export const Burstable: Story = {
	render: () => <PodCgroupMapper />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Burstable" }),
		);
	},
};
export const BestEffort: Story = {
	render: () => <PodCgroupMapper />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "BestEffort" }),
		);
	},
};
