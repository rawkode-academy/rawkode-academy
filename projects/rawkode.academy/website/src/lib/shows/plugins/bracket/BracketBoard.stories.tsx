import type { Meta, StoryObj } from "@storybook/react";
import { academyDocument } from "@rawkodeacademy/design-system";
import { expect, waitFor, within } from "storybook/test";
import { VueInReact } from "@/components/vue-wrapper";
import BracketBoard from "./BracketBoard.vue";
import { longNamesBracket, twoRoundBracket } from "./BracketBoard.fixtures";
import type { Bracket } from "./queries";

function BracketFixture({ brackets }: { brackets: Bracket[] }) {
	return <VueInReact component={BracketBoard} props={{ brackets }} />;
}

const doc = academyDocument();
const meta = {
	title: "Academy/Bracket board",
	component: BracketFixture,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"Production SSR-compatible presentation with local fixtures only. No service binding, requests, authentication, or mutation. Use the theme toolbar and a narrow canvas to review scrolling and long names.",
			},
		},
	},
	decorators: [
		(Story) => (
			<div className={[doc.root, doc.section].join(" ")}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof BracketFixture>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
	args: { brackets: [] },
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByText("No brackets are available yet.");
	},
};

export const TwoRoundsLiveAndWinner: Story = {
	args: { brackets: [twoRoundBracket] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const board = await canvas.findByRole("region", {
			name: "Local fixture tournament rounds",
		});
		expect(board).toHaveAttribute("tabindex", "0");
		expect(canvas.getByRole("heading", { name: "Round 2" })).toBeVisible();
		expect(canvas.getByText("Live", { exact: true })).toBeVisible();
		expect(canvas.getByText("Winner: Fixture Control Plane")).toBeVisible();
		board.focus();
		await waitFor(() => expect(board).toHaveFocus());
	},
};

export const LongNames: Story = { args: { brackets: [longNamesBracket] } };
export const MatchesNotAnnounced: Story = {
	args: {
		brackets: [
			{ ...twoRoundBracket, matches: [], status: "scheduled", startsAt: "" },
		],
	},
};
